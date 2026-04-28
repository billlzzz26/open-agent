import fetch from "node-fetch";

class Context7Client {
  private url: string = "https://mcp.context7.com/mcp";
  private headers: Record<string, string>;
  private id: number = 1;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.CONTEXT7_API_KEY;
    if (!key) {
      throw new Error(
        "Context7 API key is required. Provide it as parameter or set CONTEXT7_API_KEY environment variable.",
      );
    }
    this.headers = {
      CONTEXT7_API_KEY: key,
      "Content-Type": "application/json",
    };
  }

  async call(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<unknown> {
    const payload = {
      jsonrpc: "2.0",
      method,
      id: this.id,
      params,
    };
    this.id++;

    const response = await fetch(this.url, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Context7 API call failed with status ${response.status}: ${errorText}`,
      );
    }

    return await response.json();
  }
}

// Usage example
// const client = new Context7Client(); // uses env var
// const client = new Context7Client('your_api_key_here'); // explicit key
// client.call('tools/list').then(result => console.log(result));

export { Context7Client };
