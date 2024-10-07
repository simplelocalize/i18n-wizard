# String to i18n - AI Transformer 

Small CLI utility tool that helps you minizse manual effort for moving inline strings in your source code to any i18n library.
CLI will parse your source code and move all inline strings to i18n library, 
generate [translation keys following best practices](https://simplelocalize.io/blog/posts/best-practices-for-translation-keys/),
and export them to a JSON file. Exported JSON file can be easily imported to [SimpleLocalize](https://simplelocalize.io), to organize and manage your translations.

The CLI uses your OpenAI API key to generate translation keys. You can get your API key [here](https://platform.openai.com/account/api-keys).

## Word from the author

This CLI is a proof of concept and is not production-ready, thus it's a good idea to not run this on source that is not under version control,
or to make a backup of your source code before running the CLI.
It doesn't handle all edge cases, and the output may be different between runs, depending on the OpenAI model and the input code.
It may require some manual adjustments after running the CLI, but it should help you minimize manual effort for moving inline strings to i18n library.

Feel free to fork the repository and modify the code to fit your needs, or create a PR with new features.

## Usage

Then run the command:

```bash
npx @simplelocalize/string-to-i18n@1.0.0 --openAiKey <YOUR_OPEN_AI_KEY> ./my-directory/**/*.{tsx,ts}
```

## Options

### `--output`

Output file path. By default, the CLI will save the output to the `./extraction.json` file.

### `--openAiKey`

OpenAI API key. You can get your API key [here](https://platform.openai.com/account/api-keys).
If you don't provide the key, the CLI will take it from the `OPENAI_API_KEY` environment variable.

### `--openAiModel`

OpenAI model. You can choose from `gpt-3.5-turbo` or `gpt-3.5`. Default is `gpt-3.5-turbo`.

### `--generateDiff`

Generate a diff file with changes made by the CLI. By default, the CLI will not generate a diff file. Default: `false`.

### `--applyDiff`

Apply the diff file to the source code. By default, the CLI will not apply the diff file. Default: `false`.


### Customizations and modifications

Feel free to fork the repository and modify the code to fit your needs, or create a PR with new features.
