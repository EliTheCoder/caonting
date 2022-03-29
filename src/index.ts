import {Client, ClientOptions, Intents, Message} from "discord.js";
import {readFileSync, writeFileSync, existsSync} from "fs";
import {join} from "path";
import betterLogging from "better-logging";
betterLogging(console);

if (!existsSync(join(__dirname, "../config.json"))) {
	throw new Error("No config.json found");
}

const {token, channelId, guildId} = JSON.parse(
	readFileSync(join(__dirname, "../config.json"), "utf8")
);

let data = {count: 0, record: 0, lastUser: ""};
if (existsSync(join(__dirname, "../data.json"))) {
	data = JSON.parse(
		readFileSync(join(__dirname, "../data.json"), "utf8")
	) as {count: number; record: number; lastUser: string};
} else {
	writeFileSync(
		join(__dirname, "../data.json"),
		JSON.stringify({count: 0, record: 0, lastUser: ""}),
		"utf8"
	);
}

const client = new Client({
	intents: [
		Intents.FLAGS.GUILDS,
		Intents.FLAGS.GUILD_MESSAGES,
		Intents.FLAGS.GUILD_MESSAGE_REACTIONS
	]
} as ClientOptions);

client.once("ready", () => {
	console.info("Bot is ready.");
});

client.on("messageCreate", msg => {
	if (msg.channel.id !== channelId) return;
	if (msg.author.bot) return;
	count(msg);
	save();
});

client.on("interactionCreate", async interaction => {
	if (!interaction.isCommand()) return;

	const {commandName} = interaction;

	if (commandName === "ping") {
		await interaction.reply(`Pong (${client.ws.ping}ms)`);
	} else if (commandName === "count") {
		if (data.lastUser) {
			const guild = await client.guilds.fetch(guildId);
			await interaction.reply(
				`The last counted number was **${data.count}** by ${
					(
						await guild.members.fetch(data.lastUser)
					).displayName
				}`
			);
		} else {
			await interaction.reply(
				`The last counted number was **${data.count}**`
			);
		}
	} else if (commandName === "record") {
		await interaction.reply(`The current record is **${data.record}**`);
	}
});

function count(msg: Message) {
	const numberStr = msg.content.match(/^\d+([\s]|$)/);
	if (!numberStr) {
		msg.react("🔤");
		return;
	}
	const number = parseInt(numberStr[0].trim());
	if (number !== data.count + 1) {
		msg.react("❌");
		data.count = 0;
		data.lastUser = "";
		return msg.reply(
			`**You failed.** The next number was **${data.count + 1}**`
		);
	}
	if (msg.author.id === data.lastUser) {
		msg.react("❌");
		data.count = 0;
		data.lastUser = "";
		return msg.reply(`**You failed.** You can't count twice in a row.`);
	}
	data.lastUser = msg.author.id;
	data.count++;
	if (data.count > data.record) {
		data.record = data.count;
		return msg.react("☑️");
	} else {
		return msg.react("✅");
	}
}

function save() {
	writeFileSync(
		join(__dirname, "../data.json"),
		JSON.stringify(data),
		"utf8"
	);
}

client.login(token);
