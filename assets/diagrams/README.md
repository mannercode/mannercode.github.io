# Article diagrams

These two ditaa diagrams produce PNG output even when PlantUML is asked for SVG.
The articles embed the PNG files directly so the image format and MIME type match.
Both languages share these diagrams; the Korean filename is intentional.

To regenerate the images from their editable sources:

```sh
plantuml -tpng assets/diagrams/class-and-microservice.puml assets/diagrams/encoded-filenames.puml
```
