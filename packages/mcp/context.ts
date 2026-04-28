export const context7 = {
  type: "remote" as const,
  url: "https://mcp.context7.com/mcp",
  enabled: true,
  headers: process.env.CONTEXT7_API_KEY
    ? { CONTEXT7_API_KEY: process.env.CONTEXT7_API_KEY }
    : undefined,
  oauth: false as const,
};
