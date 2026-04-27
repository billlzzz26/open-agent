import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Mock notepad hooks
const mockGetPriorityContext = mock(() => 'Priority context content');
const mockGetWorkingMemory = mock(() => 'Working memory entries\n- Entry 1\n- Entry 2');
const mockGetManualSection = mock(() => 'Manual section content');
const mockSetPriorityContext = mock(() => ({ success: true }));
const mockAddWorkingMemoryEntry = mock(() => true);
const mockAddManualEntry = mock(() => true);
const mockPruneOldEntries = mock(() => ({ pruned: 2, remaining: 5 }));
const mockGetNotepadStats = mock(() => ({
    exists: true,
    totalSize: 1024,
    prioritySize: 256,
    workingMemoryEntries: 3,
    oldestEntry: '2024-01-01'
}));
const mockFormatFullNotepad = mock(() => '## Priority Context\nContent\n\n## Working Memory\nEntries\n\n## MANUAL\nManual content');
const mockDEFAULT_CONFIG = { workingMemoryDays: 7 };

mock.module('../hooks/notepad/index.js', () => ({
    getPriorityContext: mockGetPriorityContext,
    getWorkingMemory: mockGetWorkingMemory,
    getManualSection: mockGetManualSection,
    setPriorityContext: mockSetPriorityContext,
    addWorkingMemoryEntry: mockAddWorkingMemoryEntry,
    addManualEntry: mockAddManualEntry,
    pruneOldEntries: mockPruneOldEntries,
    getNotepadStats: mockGetNotepadStats,
    formatFullNotepad: mockFormatFullNotepad,
    DEFAULT_CONFIG: mockDEFAULT_CONFIG
}));

// Mock worktree paths
const mockGetWorktreeNotepadPath = mock((root: string) => path.join(root, '.omc', 'notepad.md'));
const mockEnsureOmcDir = mock(() => {});
const mockValidateWorkingDirectory = mock((wd?: string) => wd || '/test/root');

mock.module('../lib/worktree-paths.js', () => ({
    getWorktreeNotepadPath: mockGetWorktreeNotepadPath,
    ensureOmcDir: mockEnsureOmcDir,
    validateWorkingDirectory: mockValidateWorkingDirectory
}));

// Import after mocking
const { notepadTools } = await import('./notepad');

describe('Notepad Tools', () => {
    let testRoot: string;

    beforeEach(async () => {
        testRoot = await mkdtemp(path.join(tmpdir(), 'notepad-test-'));

        // Reset all mocks
        Object.values({
            mockGetPriorityContext, mockGetWorkingMemory, mockGetManualSection,
            mockSetPriorityContext, mockAddWorkingMemoryEntry, mockAddManualEntry,
            mockPruneOldEntries, mockGetNotepadStats, mockFormatFullNotepad,
            mockGetWorktreeNotepadPath, mockEnsureOmcDir, mockValidateWorkingDirectory
        }).forEach(mock => mock.mockClear());
    });

    afterEach(async () => {
        try {
            await rm(testRoot, { recursive: true, force: true });
        } catch {
            // Ignore cleanup errors
        }
    });

    test('should export notepadTools array with 6 tools', () => {
        expect(Array.isArray(notepadTools)).toBe(true);
        expect(notepadTools.length).toBe(6);

        const toolNames = notepadTools.map(t => t.name);
        expect(toolNames).toEqual([
            'notepad_read',
            'notepad_write_priority',
            'notepad_write_working',
            'notepad_write_manual',
            'notepad_prune',
            'notepad_stats'
        ]);
    });

    test('each tool should have required properties with correct types', () => {
        for (const tool of notepadTools) {
            expect(tool).toHaveProperty('name');
            expect(tool).toHaveProperty('description');
            expect(tool).toHaveProperty('schema');
            expect(tool).toHaveProperty('handler');

            expect(typeof tool.name).toBe('string');
            expect(typeof tool.description).toBe('string');
            expect(typeof tool.handler).toBe('function');
            expect(typeof tool.schema).toBe('object');
        }
    });

    describe('notepad_read tool', () => {
        test('should read full notepad when section is "all"', async () => {
            const result = await notepadTools[0].handler({
                section: 'all',
                workingDirectory: testRoot
            });

            expect(mockValidateWorkingDirectory).toHaveBeenCalledWith(testRoot);
            expect(mockFormatFullNotepad).toHaveBeenCalledWith(testRoot);
            expect(result.content[0].text).toContain('## Notepad');
            expect(result.content[0].text).toContain('Path:');
        });

        test('should read priority section', async () => {
            const result = await notepadTools[0].handler({
                section: 'priority',
                workingDirectory: testRoot
            });

            expect(mockGetPriorityContext).toHaveBeenCalledWith(testRoot);
            expect(result.content[0].text).toBe('## Priority Context\n\nPriority context content');
        });

        test('should read working memory section', async () => {
            const result = await notepadTools[0].handler({
                section: 'working',
                workingDirectory: testRoot
            });

            expect(mockGetWorkingMemory).toHaveBeenCalledWith(testRoot);
            expect(result.content[0].text).toBe('## Working Memory\n\nWorking memory entries\n- Entry 1\n- Entry 2');
        });

        test('should read manual section', async () => {
            const result = await notepadTools[0].handler({
                section: 'manual',
                workingDirectory: testRoot
            });

            expect(mockGetManualSection).toHaveBeenCalledWith(testRoot);
            expect(result.content[0].text).toBe('## MANUAL\n\nManual section content');
        });

        test('should handle empty sections', async () => {
            mockGetPriorityContext.mockReturnValueOnce(null);

            const result = await notepadTools[0].handler({
                section: 'priority',
                workingDirectory: testRoot
            });

            expect(result.content[0].text).toBe('## Priority Context\n\n(Empty or notepad does not exist)');
        });

        test('should handle missing notepad', async () => {
            mockFormatFullNotepad.mockReturnValueOnce(null);

            const result = await notepadTools[0].handler({
                section: 'all',
                workingDirectory: testRoot
            });

            expect(result.content[0].text).toBe('Notepad does not exist. Use notepad_write_* tools to create it.');
        });

        test('should use default working directory', async () => {
            const result = await notepadTools[0].handler({
                section: 'all'
            });

            expect(mockValidateWorkingDirectory).toHaveBeenCalledWith(undefined);
        });
    });

    describe('notepad_write_priority tool', () => {
        test('should write priority context successfully', async () => {
            const result = await notepadTools[1].handler({
                content: 'New priority content',
                workingDirectory: testRoot
            });

            expect(mockValidateWorkingDirectory).toHaveBeenCalledWith(testRoot);
            expect(mockEnsureOmcDir).toHaveBeenCalled();
            expect(mockSetPriorityContext).toHaveBeenCalledWith(testRoot, 'New priority content');
            expect(result.content[0].text).toBe('Successfully wrote to Priority Context (20 chars)');
        });

        test('should handle write failure', async () => {
            mockSetPriorityContext.mockReturnValueOnce({ success: false });

            const result = await notepadTools[1].handler({
                content: 'Content',
                workingDirectory: testRoot
            });

            expect(result.content[0].text).toBe('Failed to write to Priority Context. Check file permissions.');
        });

        test('should show warning on long content', async () => {
            mockSetPriorityContext.mockReturnValueOnce({
                success: true,
                warning: 'Content exceeds recommended length'
            });

            const result = await notepadTools[1].handler({
                content: 'Very long content that exceeds limits',
                workingDirectory: testRoot
            });

            expect(result.content[0].text).toContain('**Warning:** Content exceeds recommended length');
        });

        test('should accept content up to max length', async () => {
            const maxContent = 'x'.repeat(2000);

            const result = await notepadTools[1].handler({
                content: maxContent,
                workingDirectory: testRoot
            });

            expect(result.content[0].text).toContain('Successfully wrote');
        });
    });

    describe('notepad_write_working tool', () => {
        test('should add working memory entry successfully', async () => {
            const result = await notepadTools[2].handler({
                content: 'New working memory entry',
                workingDirectory: testRoot
            });

            expect(mockAddWorkingMemoryEntry).toHaveBeenCalledWith(testRoot, 'New working memory entry');
            expect(result.content[0].text).toBe('Successfully added entry to Working Memory (24 chars)');
        });

        test('should handle add failure', async () => {
            mockAddWorkingMemoryEntry.mockReturnValueOnce(false);

            const result = await notepadTools[2].handler({
                content: 'Content',
                workingDirectory: testRoot
            });

            expect(result.content[0].text).toBe('Failed to add entry to Working Memory. Check file permissions.');
        });
    });

    describe('notepad_write_manual tool', () => {
        test('should add manual entry successfully', async () => {
            const result = await notepadTools[3].handler({
                content: 'New manual entry',
                workingDirectory: testRoot
            });

            expect(mockAddManualEntry).toHaveBeenCalledWith(testRoot, 'New manual entry');
            expect(result.content[0].text).toBe('Successfully added entry to MANUAL section (16 chars)');
        });

        test('should handle add failure', async () => {
            mockAddManualEntry.mockReturnValueOnce(false);

            const result = await notepadTools[3].handler({
                content: 'Content',
                workingDirectory: testRoot
            });

            expect(result.content[0].text).toBe('Failed to add entry to MANUAL section. Check file permissions.');
        });
    });

    describe('notepad_prune tool', () => {
        test('should prune entries with default days', async () => {
            const result = await notepadTools[4].handler({
                workingDirectory: testRoot
            });

            expect(mockPruneOldEntries).toHaveBeenCalledWith(testRoot, 7);
            expect(result.content[0].text).toBe('## Prune Results\n\n- Pruned: 2 entries\n- Remaining: 5 entries\n- Threshold: 7 days');
        });

        test('should prune entries with custom days', async () => {
            const result = await notepadTools[4].handler({
                daysOld: 14,
                workingDirectory: testRoot
            });

            expect(mockPruneOldEntries).toHaveBeenCalledWith(testRoot, 14);
            expect(result.content[0].text).toContain('Threshold: 14 days');
        });
    });

    describe('notepad_stats tool', () => {
        test('should get notepad statistics', async () => {
            const result = await notepadTools[5].handler({
                workingDirectory: testRoot
            });

            expect(mockGetNotepadStats).toHaveBeenCalledWith(testRoot);
            expect(result.content[0].text).toContain('## Notepad Statistics');
            expect(result.content[0].text).toContain('**Total Size:** 1024 bytes');
            expect(result.content[0].text).toContain('**Working Memory Entries:** 3');
            expect(result.content[0].text).toContain('Path:');
        });

        test('should handle non-existent notepad', async () => {
            mockGetNotepadStats.mockReturnValueOnce({ exists: false });

            const result = await notepadTools[5].handler({
                workingDirectory: testRoot
            });

            expect(result.content[0].text).toBe('## Notepad Statistics\n\nNotepad does not exist yet.');
        });
    });

    describe('error handling', () => {
        test('should handle validation errors', async () => {
            mockValidateWorkingDirectory.mockImplementationOnce(() => {
                throw new Error('Invalid working directory');
            });

            const result = await notepadTools[0].handler({
                section: 'all',
                workingDirectory: '/invalid/path'
            });

            expect(result.content[0].text).toBe('Error reading notepad: Invalid working directory');
        });

        test('should handle hook errors', async () => {
            mockGetPriorityContext.mockImplementationOnce(() => {
                throw new Error('File system error');
            });

            const result = await notepadTools[0].handler({
                section: 'priority',
                workingDirectory: testRoot
            });

            expect(result.content[0].text).toBe('Error reading notepad: File system error');
        });
    });

    describe('schema validation', () => {
        test('notepad_write_priority should have content schema', () => {
            expect(notepadTools[1].schema).toHaveProperty('content');
        });

        test('write tools should have content schema', () => {
            expect(notepadTools[2].schema).toHaveProperty('content');
            expect(notepadTools[3].schema).toHaveProperty('content');
        });

        test('notepad_prune should have daysOld schema', () => {
            expect(notepadTools[4].schema).toHaveProperty('daysOld');
        });
    });
});