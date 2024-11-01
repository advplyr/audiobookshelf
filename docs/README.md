# OpenAPI specification

This directory includes the OpenAPI spec for the ABS server. The spec is made up of a number of individual `yaml` files located here and in the subfolders, with `root.yaml` being the file that references all of the others. The files are organized to have the same hierarchy as the server source files. The full spec is bundled into one file in `openapi.json`.

The spec is linted and bundled using [`redocly-cli`](https://redocly.com/docs/cli/). This tool also generates HTML docs for the spec.

The tools created by [`pb33f`](https://pb33f.io/), specifically `vacuum` and `wiretap`, are also useful for linting and verification. These tools check for some other things, such as validating requests to and responses from the server.

### Bundling the spec

The command used to bundle the spec into a `yaml` file is `redocly bundle root.yaml > bundled.yaml`.

The `yq` tool is used to convert the `yaml` to a `json` using the `yq -p yaml -o json bundled.yaml > openapi.json`.

### Linting the spec

The command used to lint the spec is `redocly lint root.yaml`

To generate an HTML report using `vacuum`, you can use `vacuum html-report [file]` to generate `report.html` and view the report in your browser.

### Generating documentation

Redocly allows for creating a static HTML page to document the API. This is done by using `redocly build-docs [file]` and supports exploded specs.

### Putting it all together

The full command that I run to bundle the spec and generate the documentation is:

```
redocly bundle root.yaml > bundled.yaml && \
yq -p yaml -o json bundled.yaml > openapi.json && \
redocly build-docs openapi.json
```
