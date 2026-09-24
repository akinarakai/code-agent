import { Text, Box } from 'ink';
import { lexer, type Token } from 'marked';

interface MarkdownProps {
    text: string;
}

export function Markdown({ text }: MarkdownProps) {
    const tokens = lexer(text);

    const renderInlineToken = (
        token: Token,
        index: number
    ): React.ReactNode => {
        switch (token.type) {
            case 'text':
                return (
                    <Text key={index}>
                        {token.text}
                    </Text>
                );

            case 'strong':
                return (
                    <Text key={index} bold>
                        {token.tokens
                            ? token.tokens.map((t, i) =>
                                renderInlineToken(t, i)
                            )
                            : token.text}
                    </Text>
                );

            case 'em':
                return (
                    <Text key={index} italic>
                        {token.tokens
                            ? token.tokens.map((t, i) =>
                                renderInlineToken(t, i)
                            )
                            : token.text}
                    </Text>
                );

            case 'codespan':
                return (
                    <Text
                        key={index}
                        backgroundColor="white"
                        color="black"
                    >
                        {` ${token.text} `}
                    </Text>
                );

            case 'del':
                return (
                    <Text key={index} strikethrough>
                        {token.tokens
                            ? token.tokens.map((t, i) =>
                                renderInlineToken(t, i)
                            )
                            : token.text}
                    </Text>
                );

            case 'link':
                return (
                    <Text key={index} underline>
                        {token.tokens
                            ? token.tokens.map((t, i) =>
                                renderInlineToken(t, i)
                            )
                            : token.text}
                    </Text>
                );

            case 'br':
                return <Text key={index}>{'\n'}</Text>;

            default:
                return (
                    <Text key={index}>
                        {'text' in token
                            ? token.text
                            : token.raw}
                    </Text>
                );
        }
    };

    const renderToken = (
        token: Token,
        index: number
    ): React.ReactNode => {
        switch (token.type) {
            case 'space':
                return null;

            case 'paragraph':
                return (
                    <Text key={index}>
                        {token.tokens?.map((t, i) =>
                            renderInlineToken(t, i)
                        )}
                    </Text>
                );

            case 'heading':
                return (
                    <Box key={index} flexDirection="column">
                        <Text bold>
                            {token.tokens?.map((t, i) =>
                                renderInlineToken(t, i)
                            )}
                        </Text>
                    </Box>
                );

            case 'code':
                return (
                    <Box key={index} flexDirection="column">
                        <Text>{token.text}</Text>
                    </Box>
                );

            case 'blockquote':
                return (
                    <Box key={index} flexDirection="column">
                        <Text dimColor>
                            {token.tokens?.map((t, i) =>
                                renderToken(t, i)
                            )}
                        </Text>
                    </Box>
                );

            /*
        case 'list':
            return (
                <Box key={index} flexDirection="column">
                    {token.items.map((item, i) => (
                        <Box key={i} flexDirection="row">
                            <Text>• </Text>

                            <Box flexDirection="column">
                                {item.tokens.map((t, j) =>
                                    renderToken(t, j)
                                )}
                            </Box>
                        </Box>
                    ))}
                </Box>
            );
            */

            case 'hr':
                return (
                    <Text key={index}>
                        {'─'.repeat(40)}
                    </Text>
                );

            case 'text':
                return (
                    <Text key={index}>
                        {token.text}
                    </Text>
                );

            default:
                return (
                    <Text key={index}>
                        {token.raw}
                    </Text>
                );
        }
    };

    return (
        <Box flexDirection="column">
            {tokens.map((token, i) =>
                renderToken(token, i)
            )}
        </Box>
    );
}