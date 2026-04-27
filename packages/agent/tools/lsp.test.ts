import { describe, test, expect, mock, beforeEach } from 'bun:test';

// Mock LSP dependencies
const mockLspClientManager = {
    runWithClientLease: mock(async (filePath: string, fn: any) => {
        const mockClient = {
            hover: mock(async () => ({
                contents: [{ kind: 'markdown', value: 'Test hover content' }],
                range: { start: { line: 0, character: 0 }, end: { line: 0, character: 10 } }
            })),
            definition: mock(async () => ([{
                uri: 'file:///test/file.ts',
                range: { start: { line: 5, character: 0 }, end: { line: 5, character: 15 } }
            }])),
            references: mock(async () => ([{
                uri: 'file:///test/file.ts',
                range: { start: { line: 10, character: 0 }, end: { line: 10, character: 10 } }
            }])),
            documentSymbols: mock(async () => ([{
                name: 'testFunction',
                kind: 12, // Function
                range: { start: { line: 5, character: 0 }, end: { line: 5, character: 20 } },
                selectionRange: { start: { line: 5, character: 9 }, end: { line: 5, character: 21 } }
            }])),
            workspaceSymbols: mock(async () => ([{
                name: 'TestClass',
                kind: 5, // Class
                location: {
                    uri: 'file:///test/class.ts',
                    range: { start: { line: 1, character: 0 }, end: { line: 1, character: 10 } }
                }
            }])),
            openDocument: mock(async () => {}),
            waitForDiagnostics: mock(async () => {}),
            getDiagnostics: mock(() => ([{
                range: { start: { line: 1, character: 5 }, end: { line: 1, character: 10 } },
                severity: 1,
                message: 'Test error',
                source: 'test'
            }])),
            prepareRename: mock(async () => ({
                start: { line: 1, character: 0 },
                end: { line: 1, character: 5 }
            })),
            rename: mock(async () => ({
                changes: {
                    'file:///test/file.ts': [{
                        range: { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } },
                        newText: 'newName'
                    }]
                }
            })),
            codeActions: mock(async () => ([{
                title: 'Extract function',
                kind: 'refactor.extract',
                edit: {
                    changes: {
                        'file:///test/file.ts': [{
                            range: { start: { line: 2, character: 0 }, end: { line: 4, character: 0 } },
                            newText: 'extractedFunction() {\n  // code\n}'
                        }]
                    }
                }
            }])),
            supportsPullDiagnostics: false
        };
        return await fn(mockClient);
    })
};

const mockGetAllServers = mock(() => ([
    { name: 'typescript', command: 'tsserver', extensions: ['.ts', '.tsx'], installed: true },
    { name: 'python', command: 'pylsp', extensions: ['.py'], installed: false, installHint: 'pip install python-lsp-server' }
]));

const mockGetServerForFile = mock((filePath: string) => {
    if (filePath.endsWith('.ts')) {
        return { name: 'typescript', command: 'tsserver', extensions: ['.ts', '.tsx'], installed: true };
    }
    return null;
});

const mockFormatHover = mock((hover: any) => 'Formatted hover: Test hover content');
const mockFormatLocations = mock((locations: any) => 'Found 1 location(s)');
const mockFormatDocumentSymbols = mock((symbols: any) => '1 symbol(s) found');
const mockFormatWorkspaceSymbols = mock((symbols: any) => 'Found 1 symbol(s)');
const mockFormatDiagnostics = mock((diagnostics: any) => 'Found 1 diagnostic(s)');
const mockFormatCodeActions = mock((actions: any) => 'Found 1 code action(s)');
const mockFormatWorkspaceEdit = mock((edit: any) => 'Workspace edit applied');
const mockCountEdits = mock(() => ({ files: 1, edits: 1 }));

mock.module('./lsp/index.js', () => ({
    lspClientManager: mockLspClientManager,
    getAllServers: mockGetAllServers,
    getServerForFile: mockGetServerForFile,
    formatHover: mockFormatHover,
    formatLocations: mockFormatLocations,
    formatDocumentSymbols: mockFormatDocumentSymbols,
    formatWorkspaceSymbols: mockFormatWorkspaceSymbols,
    formatDiagnostics: mockFormatDiagnostics,
    formatCodeActions: mockFormatCodeActions,
    formatWorkspaceEdit: mockFormatWorkspaceEdit,
    countEdits: mockCountEdits
}));

mock.module('./diagnostics/index.js', () => ({
    runDirectoryDiagnostics: mock(async () => ({
        strategy: 'tsc',
        summary: '2 errors, 1 warning',
        diagnostics: 'Error: test error\nWarning: test warning'
    }))
}));

// Import after mocking
const { lspTools } = await import('./lsp');

describe('LSP Tools', () => {
    beforeEach(() => {
        // Reset all mocks
        mockLspClientManager.runWithClientLease.mockClear();
        mockGetAllServers.mockClear();
        mockGetServerForFile.mockClear();
        Object.values({
            mockFormatHover, mockFormatLocations, mockFormatDocumentSymbols,
            mockFormatWorkspaceSymbols, mockFormatDiagnostics, mockFormatCodeActions,
            mockFormatWorkspaceEdit, mockCountEdits
        }).forEach(mock => mock.mockClear());
    });

    test('should export lspTools array with expected tools', () => {
        expect(Array.isArray(lspTools)).toBe(true);
        expect(lspTools.length).toBe(12); // All LSP tools

        const toolNames = lspTools.map(t => t.name);
        expect(toolNames).toEqual([
            'lsp_hover',
            'lsp_goto_definition',
            'lsp_find_references',
            'lsp_document_symbols',
            'lsp_workspace_symbols',
            'lsp_diagnostics',
            'lsp_diagnostics_directory',
            'lsp_servers',
            'lsp_prepare_rename',
            'lsp_rename',
            'lsp_code_actions',
            'lsp_code_action_resolve'
        ]);
    });

    test('each tool should have required properties with correct types', () => {
        for (const tool of lspTools) {
            expect(tool).toHaveProperty('name');
            expect(tool).toHaveProperty('description');
            expect(tool).toHaveProperty('schema');
            expect(tool).toHaveProperty('handler');

            expect(typeof tool.name).toBe('string');
            expect(typeof tool.description).toBe('string');
            expect(typeof tool.handler).toBe('function');

            // Schema should be an object with properties
            expect(typeof tool.schema).toBe('object');
        }
    });

    describe('lsp_hover tool', () => {
        test('should call LSP hover and format result', async () => {
            const result = await lspTools[0].handler({
                file: 'test.ts',
                line: 1,
                character: 5
            });

            expect(mockLspClientManager.runWithClientLease).toHaveBeenCalledWith(
                'test.ts',
                expect.any(Function)
            );
            expect(mockFormatHover).toHaveBeenCalled();
            expect(result.content[0].text).toBe('Formatted hover: Test hover content');
        });
    });

    describe('lsp_goto_definition tool', () => {
        test('should find definition locations', async () => {
            const result = await lspTools[1].handler({
                file: 'test.ts',
                line: 1,
                character: 5
            });

            expect(mockFormatLocations).toHaveBeenCalledWith([{
                uri: 'file:///test/file.ts',
                range: { start: { line: 5, character: 0 }, end: { line: 5, character: 15 } }
            }]);
            expect(result.content[0].text).toBe('Found 1 location(s)');
        });
    });

    describe('lsp_find_references tool', () => {
        test('should find references with includeDeclaration true', async () => {
            const result = await lspTools[2].handler({
                file: 'test.ts',
                line: 1,
                character: 5,
                includeDeclaration: true
            });

            expect(result.content[0].text).toBe('Found 1 reference(s):\n\nFound 1 location(s)');
        });

        test('should handle no references found', async () => {
            mockLspClientManager.runWithClientLease.mockImplementationOnce(async (filePath, fn) => {
                const mockClient = {
                    references: mock(async () => [])
                };
                return await fn(mockClient);
            });

            const result = await lspTools[2].handler({
                file: 'test.ts',
                line: 1,
                character: 5
            });

            expect(result.content[0].text).toBe('No references found');
        });
    });

    describe('lsp_document_symbols tool', () => {
        test('should get document symbols', async () => {
            const result = await lspTools[3].handler({
                file: 'test.ts'
            });

            expect(mockFormatDocumentSymbols).toHaveBeenCalled();
            expect(result.content[0].text).toBe('1 symbol(s) found');
        });
    });

    describe('lsp_workspace_symbols tool', () => {
        test('should search workspace symbols', async () => {
            const result = await lspTools[4].handler({
                query: 'TestClass',
                file: 'test.ts'
            });

            expect(result.content[0].text).toBe('Found 1 symbol(s) matching "TestClass":\n\nFound 1 symbol(s)');
        });

        test('should handle no symbols found', async () => {
            mockLspClientManager.runWithClientLease.mockImplementationOnce(async (filePath, fn) => {
                const mockClient = {
                    workspaceSymbols: mock(async () => [])
                };
                return await fn(mockClient);
            });

            const result = await lspTools[4].handler({
                query: 'UnknownSymbol',
                file: 'test.ts'
            });

            expect(result.content[0].text).toBe('No symbols found matching: UnknownSymbol');
        });
    });

    describe('lsp_diagnostics tool', () => {
        test('should get diagnostics with severity filter', async () => {
            const result = await lspTools[5].handler({
                file: 'test.ts',
                severity: 'error'
            });

            expect(result.content[0].text).toContain('Found 1 diagnostic(s)');
        });
    });

    describe('lsp_servers tool', () => {
        test('should list all language servers', async () => {
            const result = await lspTools[7].handler({});

            expect(mockGetAllServers).toHaveBeenCalled();
            expect(result.content[0].text).toContain('Language Server Status');
            expect(result.content[0].text).toContain('typescript');
            expect(result.content[0].text).toContain('python');
        });
    });

    describe('lsp_rename tool', () => {
        test('should perform rename and show edit summary', async () => {
            const result = await lspTools[9].handler({
                file: 'test.ts',
                line: 1,
                character: 5,
                newName: 'newFunctionName'
            });

            expect(mockCountEdits).toHaveBeenCalled();
            expect(result.content[0].text).toContain('Rename to "newFunctionName" would affect 1 file(s) with 1 edit(s)');
        });
    });

    describe('lsp_code_actions tool', () => {
        test('should get code actions for selection', async () => {
            const result = await lspTools[10].handler({
                file: 'test.ts',
                startLine: 1,
                startCharacter: 0,
                endLine: 3,
                endCharacter: 10
            });

            expect(mockFormatCodeActions).toHaveBeenCalled();
            expect(result.content[0].text).toBe('Found 1 code action(s)');
        });
    });

    describe('error handling', () => {
        test('should handle unsupported file type', async () => {
            mockGetServerForFile.mockReturnValueOnce(null);

            const result = await lspTools[0].handler({
                file: 'test.unknown',
                line: 1,
                character: 5
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toContain('No language server available');
        });

        test('should handle LSP client errors', async () => {
            mockLspClientManager.runWithClientLease.mockRejectedValueOnce(new Error('LSP connection failed'));

            const result = await lspTools[0].handler({
                file: 'test.ts',
                line: 1,
                character: 5
            });

            expect(result.isError).toBe(true);
            expect(result.content[0].text).toBe('Error in hover: LSP connection failed');
        });
    });
});