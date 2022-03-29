import {SlashCommandBuilder} from "@discordjs/builders";
import {REST} from "@discordjs/rest";
import {Routes} from "discord-api-types/v9";
import {existsSync, readFileSync} from "fs";
import {join} from "path";

if (!existsSync(join(__dirname, "../config.json"))) {
	throw new Error("No config.json found");
}

const {token, clientId, guildId} = JSON.parse(
	readFileSync(join(__dirname, "../config.json"), "utf8")
);

const commands = [
	new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Replies with pong"),
	new SlashCommandBuilder()
		.setName("record")
		.setDescription("Replies with the gulid record"),
	new SlashCommandBuilder()
		.setName("count")
		.setDescription("Replies with the guild count")
].map(command => command.toJSON());

const rest = new REST({version: "9"}).setToken(token);

rest.put(Routes.applicationGuildCommands(clientId, guildId), {body: commands})
	.then(() => console.log("Successfully registered application commands."))
	.catch(console.error);
