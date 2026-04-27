import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// Mock node-fetch
const fetchMock = mock(async (url: string, options: RequestInit) => {
    return new Response(JSON.stringify({ jsonrpc: '2.0', result: { success: true }, id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
});

mock.module('node-fetch', () => ({
    __esModule: true,
    default: fetchMock,
}));

// Mock process.env
const originalEnv = process.env;
beforeEach(() => {
    process.env = { ...originalEnv };
});
afterEach(() => {
    process.env = originalEnv;
});

// Now import the class to be tested
const { Context7Client } = await import('./kilo');

describe('Context7Client', () => {
    beforeEach(() => {
        fetchMock.mockClear();
    });

    describe('constructor', () => {
        test('should use provided API key', () => {
            const client = new Context7Client('test-api-key');
            expect(client).toBeDefined();
        });

        test('should use environment variable if no key provided', () => {
            process.env.CONTEXT7_API_KEY = 'env-api-key';
            const client = new Context7Client();
            expect(client).toBeDefined();
        });

        test('should throw error if no API key available', () => {
            delete process.env.CONTEXT7_API_KEY;
            expect(() => new Context7Client()).toThrow('Context7 API key is required. Provide it as parameter or set CONTEXT7_API_KEY environment variable.');
        });
    });

    describe('call method', () => {
        let client: Context7Client;

        beforeEach(() => {
            process.env.CONTEXT7_API_KEY = 'test-api-key';
            client = new Context7Client();
        });

        test('should make POST request with correct headers and payload', async () => {
            await client.call('test.method', { param: 'value' });

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [url, options] = fetchMock.mock.calls[0];

            expect(url).toBe('https://mcp.context7.com/mcp');
            expect(options?.method).toBe('POST');
            expect(options?.headers).toEqual({
                'CONTEXT7_API_KEY': 'test-api-key',
                'Content-Type': 'application/json',
            });

            const body = JSON.parse(options?.body as string);
            expect(body).toEqual({
                jsonrpc: '2.0',
                method: 'test.method',
                id: 1,
                params: { param: 'value' },
            });
        });

        test('should increment request ID for multiple calls', async () => {
            await client.call('method1');
            await client.call('method2');
            await client.call('method3');

            expect(fetchMock).toHaveBeenCalledTimes(3);

            const bodies = fetchMock.mock.calls.map(([_, options]) =>
                JSON.parse((options as RequestInit)?.body as string)
            );

            expect(bodies[0].id).toBe(1);
            expect(bodies[1].id).toBe(2);
            expect(bodies[2].id).toBe(3);
        });

        test('should handle empty params', async () => {
            await client.call('test.method');

            const [_, options] = fetchMock.mock.calls[0];
            const body = JSON.parse((options as RequestInit)?.body as string);
            expect(body.params).toEqual({});
        });

        test('should return parsed JSON response', async () => {
            const mockResponse = {
                jsonrpc: '2.0',
                result: { tools: ['tool1', 'tool2'] },
                id: 1
            };
            fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(mockResponse)));

            const result = await client.call('tools/list');
            expect(result).toEqual(mockResponse);
        });

        test('should handle error responses', async () => {
            const errorResponse = {
                jsonrpc: '2.0',
                error: { code: -32601, message: 'Method not found' },
                id: 1
            };
            fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(errorResponse)));

            const result = await client.call('invalid.method');
            expect(result).toEqual(errorResponse);
        });

        test('should throw on HTTP errors', async () => {
            fetchMock.mockResolvedValueOnce(new Response('Forbidden', { status: 403 }));

            await expect(client.call('tools/list')).rejects.toThrow(
                'Context7 API call failed with status 403: Forbidden'
            );
        });

        test('should handle network errors', async () => {
            fetchMock.mockRejectedValueOnce(new Error('Network timeout'));

            await expect(client.call('tools/list')).rejects.toThrow('Network timeout');
        });

        test('should handle malformed JSON response', async () => {
            fetchMock.mockResolvedValueOnce(new Response('invalid json', {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }));

            await expect(client.call('tools/list')).rejects.toThrow();
        });
    });

    describe('integration scenarios', () => {
        let client: Context7Client;

        beforeEach(() => {
            process.env.CONTEXT7_API_KEY = 'test-api-key';
            client = new Context7Client();
        });

        test('should handle tools/list call', async () => {
            const mockResponse = {
                jsonrpc: '2.0',
                result: {
                    tools: [
                        { name: 'query-docs', description: 'Query documentation' },
                        { name: 'resolve-library-id', description: 'Resolve library ID' }
                    ]
                },
                id: 1
            };
            fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(mockResponse)));

            const result = await client.call('tools/list');
            expect(result.result.tools).toHaveLength(2);
            expect(result.result.tools[0].name).toBe('query-docs');
        });

        test('should handle query-docs call with complex params', async () => {
            const params = {
                libraryId: '/reactjs/react.dev',
                query: 'how to use useState hook'
            };

            await client.call('tools/call', {
                name: 'query-docs',
                arguments: params
            });

            const [_, options] = fetchMock.mock.calls[0];
            const body = JSON.parse((options as RequestInit)?.body as string);

            expect(body.params.name).toBe('query-docs');
            expect(body.params.arguments.libraryId).toBe('/reactjs/react.dev');
        });
    });
});
