import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bakery Menu API",
  // Documentation, not a page customers should land on from a search.
  robots: { index: false, follow: false },
};

/**
 * Swagger UI for the read-only menu API.
 *
 * The bundle is loaded from a CDN rather than added to the dependency tree —
 * it is a developer page, and the customer menu should not carry a megabyte of
 * documentation UI in its build.
 */
export default function ApiDocsPage() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui.min.css"
      />
      <div id="swagger-ui" />
      <script
        src="https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/5.17.14/swagger-ui-bundle.min.js"
        defer
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
            window.addEventListener('load', function () {
              window.SwaggerUIBundle({
                url: '/api/v1/openapi.yaml',
                dom_id: '#swagger-ui',
                deepLinking: true,
                displayRequestDuration: true,
                tryItOutEnabled: true,
              });
            });
          `,
        }}
      />
    </>
  );
}
