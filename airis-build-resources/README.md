# Frozen production model resources

When `AIRIS_PREPARED_MODELS=true`, the private build context contains
`model-resources.tar.gz` and `model-resources.sha256` here. The archive holds only
the accepted embedding, Whisper, tiktoken and NLTK caches from the immutable image.
Its checksum and extracted file manifest are checked before use; no database,
uploads, configuration or credentials belong in this directory.

The resources are copied into the clean platform image during its dependency
installation. They are not an AIRIS application base image. Keep the archive out
of Git and remove it with the temporary build context after acceptance.
