# OpenAPI specification

This directory includes the OpenAPI spec for the ABS server.
The spec is made up of a number of individual `yaml` files located here and in the subfolders, with `root.yaml` being the file that references all of the others.
The files are organized to have the same hierarchy as the server source files.
The full spec is bundled into one file in `openapi.json`.

The spec is linted and bundled by the [`vacuum` tool](https://quobix.com/vacuum/).
The spec can also be tested with a real server using the [`wiretap` tool](https://pb33f.io/wiretap/).
Both of these tools are created by [pb33f](https://pb33f.io/).

### Bundling the spec
The command to bundle the spec into a `yaml` file is `vacuum bundle root.yaml openapi.yaml`.

The current version of `vacuum` cannot convert input `yaml` files to `json` files.
To convert the spec to `json`, you can use the `yq` tool or another tool.

The command to convert the spec using `yq` is `yq -p yaml -o json openapi.yaml > openapi.json`.

### Viewing report
To generate an HTML report, you can use `vacuum html-report [file]` to generate `report.html` and view the report in your browser.

### Putting it all together
The full command that I run to bundle the spec and generate the report is:

```
vacuum bundle root.yaml openapi.yaml && \
yq -p yaml -o json openapi.yaml > openapi.json && \
vacuum html-report openapi.json
```
