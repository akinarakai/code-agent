import { render } from "ink";
import { App } from "./ui/App.js"

import { Agent } from "./core/agent.js";

import * as Strategy from "./core/request/request.js"
import * as Plugin from "./core/types/plugins/default-plugin.js";

const ollama = new Strategy.OllamaStrategy("http://localhost:11434/api/chat", "gemma4:31b-cloud");

const cwd = "YOUR_PATH_TO_PROJECT";
const plugins = [new Plugin.DefaultPlugin()];

const agent = new Agent(ollama, cwd, plugins);

function Main() {
    const handleSubmit = async (text: string) => {
        if (text.startsWith("/")) {
            agent.context.commands.execute(text, agent.context);
            return;
        }

        await agent.run(text);
    }

    const handleCancel = async () => {
        await agent.stop();
    }

    return (
        <App
            agent={agent}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
        />
    );
}

render(<Main />);