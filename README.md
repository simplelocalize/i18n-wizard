# i18n Wizard - AI String to i18n transformer 

A small CLI utility that helps minimize the manual effort of moving inline strings in your source code to any i18n library. 
The CLI parses your source code, relocates all inline strings to the i18n library, 
generates [translation keys following best practices](https://simplelocalize.io/blog/posts/best-practices-for-translation-keys/), and exports them to a JSON file. 
The exported JSON file can be easily imported into [SimpleLocalize](https://simplelocalize.io) for organizing and managing your translations.

The CLI uses your OpenAI API key to generate translation keys. You can create your OpenAI API key [here](https://platform.openai.com/account/api-keys).

## Word from the author

This CLI is a proof of concept and is not production-ready, thus it's a good idea to not run this on source that is not under version control,
or to make a backup of your source code before running the CLI.
It doesn't handle all edge cases, and the output may be different between runs, depending on the OpenAI model and the input code.
It may require some manual adjustments after running the CLI, but it should help you minimize manual effort for moving inline strings to i18n library.

## Known issues

OpenAI charges much more for the output tokens than for the input tokens, so the CLI may be expensive to run on large codebases.
To optimize that I decided to ask AI to generate diffs instead of generating the whole file content. 
Unfortunately, it generates invalid diff files very often, which prevents the CLI from applying the changes to the source code.

## Contributing

Feel free to fork the repository and modify the code to fit your needs, or create a PR with new features.

## Usage

1. Create `prompt.txt` file or use one of the examples from the [./prompts directory](./prompts).
2. [Get OpenAI API key](https://platform.openai.com/account/api-keys) and add it to your env variables (`OPENAI_API_KEY`) or provide it via parameter
3. Run command with specifying a regex which files should be considered for message extraction.

```bash
npx @simplelocalize/ai-wizard ./my-directory/**/*.{tsx,ts}
```

By default, generating diff files and applying diffs is disabled, so the CLI will only extract translation keys with messages to the `extraction.json` file. See options how to enable diff generation and application.


### Placeholders

Use the following placeholders in your prompt file, they will be replaced with the actual values:

- `{__filePath__}` - the path to the currently processed file.
- `{__fileContent__}` - the content of the currently processed file.

## Options

### `--prompt`

Prompt file path. By default, the CLI will save the prompt to the `./prompt.txt` file.

### `--output`

Output file path. By default, the CLI will save the output to the `./extraction.json` file.

### `--openAiKey`

OpenAI API key. If you don't provide the key, the CLI will take it from the `OPENAI_API_KEY` environment variable.

### `--openAiModel`

OpenAI model. You can choose from `gpt-3.5-turbo` or `gpt-3.5`. Default is `gpt-3.5-turbo`.

### `--generateDiff`

Generate a diff file with changes made by the CLI. By default, the CLI will not generate a diff file. Default: `false`.

### `--applyDiff`

Apply the diff file to the source code. By default, the CLI will not apply the diff file. Default: `false`.

## Customize your prompt

The project provides a few example prompts that you can use to test the CLI. You can find them in the [`./prompts` directory](./prompts).
Prompts are used to tell the OpenAI model what you want to achieve. You can create your own prompts and the path to the txt file using the `--prompt` option.


