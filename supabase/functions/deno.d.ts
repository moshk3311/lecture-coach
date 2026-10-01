// The Deno APIs the functions use, so `tsc -b` checks them without Deno installed. The functions
// import nothing else from Deno: Web APIs (fetch, Response) come from the DOM types.
declare namespace Deno {
  const env: { get(key: string): string | undefined }
  function serve(handler: (request: Request) => Response | Promise<Response>): unknown
}
