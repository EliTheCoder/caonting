import {Client, ClientOptions, Intents, Message, Snowflake} from "discord.js";
import {REST} from "@discordjs/rest";
import {Routes} from "discord-api-types/v9";
import {readFileSync, writeFileSync, existsSync} from "fs";
import {join} from "path";
import betterLogging from "better-logging";
import {SlashCommandBuilder} from "@discordjs/builders";
betterLogging(console);

type CountingData = {
	[guildId: string]: {
		[channelId: string]: {
			count: number;
			record: number;
			lastUser: Snowflake;
		};
	};
};

if (!existsSync(join(__dirname, "../config.json"))) {
	throw new Error("No config.json found");
}

const {token, clientId} = JSON.parse(
	readFileSync(join(__dirname, "../config.json"), "utf8")
);

let data: CountingData = {};
if (existsSync(join(__dirname, "./data.json"))) {
	data = JSON.parse(
		readFileSync(join(__dirname, "./data.json"), "utf8")
	) as CountingData;
} else {
	writeFileSync(join(__dirname, "./data.json"), JSON.stringify({}), "utf8");
}

const commands = [
	new SlashCommandBuilder()
		.setName("ping")
		.setDescription("Replies with pong"),
	new SlashCommandBuilder()
		.setName("record")
		.setDescription("Replies with the guild record"),
	new SlashCommandBuilder()
		.setName("count")
		.setDescription("Replies with the guild count"),
	new SlashCommandBuilder()
		.setName("start")
		.setDescription(
			"Adds or removes this channel to the list of channels to count"
		),
	new SlashCommandBuilder()
		.setName("stop")
		.setDescription(
			"Removes this channel from the list of channels to count"
		)
].map(command => command.toJSON());

const rest = new REST({version: "9"}).setToken(token);

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

client.on("guildCreate", guild => {
	console.info(`Joined guild ${guild.name}`);
	rest.put(Routes.applicationGuildCommands(clientId, guild.id), {
		body: commands
	})
		.then(() =>
			console.log("Successfully registered application commands.")
		)
		.catch(console.error);
});

client.on("messageDelete", msg => {
	if (!msg.inGuild()) return;
	if (data[msg.guildId]?.[msg.channelId] === undefined) return;
	if (msg.author.bot) return;
	if (msg.author.id !== data[msg.guildId][msg.channelId].lastUser) return;
	const numberStr = msg.content.match(/^\d+([\s]|$)/);
	if (!numberStr) return;
	const number = parseInt(numberStr[0]);
	if (number === data[msg.guildId][msg.channelId].count) {
		msg.channel.send(
			`<@${
				msg.author.id
			}> has deleted their message. The next number is **${number + 1}**.`
		);
	}
});

client.on("messageCreate", msg => {
	if (!msg.inGuild()) return;
	if (data[msg.guildId]?.[msg.channelId] === undefined) return;
	if (msg.author.bot) return;
	count(msg);
	save();
});

client.on("interactionCreate", async interaction => {
	if (!interaction.isCommand()) return;
	if (!interaction.inGuild()) return;

	const thisData = data[interaction.guildId]?.[interaction.channelId];

	const {commandName} = interaction;

	if (commandName === "ping") {
		await interaction.reply(`Pong (${client.ws.ping}ms)`);
	} else if (commandName === "count") {
		if (data[interaction.guildId]?.[interaction.channelId] === undefined)
			return interaction.reply("No data for this channel.");
		if (thisData.lastUser) {
			const guild = await client.guilds.fetch(interaction.guild!.id);
			await interaction.reply(
				`The last counted number was **${thisData.count}** by ${
					(
						await guild.members.fetch(thisData.lastUser)
					).displayName
				}`
			);
		} else {
			await interaction.reply(
				`The last counted number was **${thisData.count}**`
			);
		}
	} else if (commandName === "record") {
		if (data[interaction.guildId]?.[interaction.channelId] === undefined)
			return interaction.reply("No data for this channel.");
		await interaction.reply(`The current record is **${thisData.record}**`);
	} else if (commandName === "start") {
		if (data[interaction.guildId] !== undefined) {
			if (
				data[interaction.guildId][interaction.channelId] !== undefined
			) {
				return interaction.reply(
					"This channel is already being counted."
				);
			} else {
				data[interaction.guildId][interaction.channelId] = {
					count: 0,
					record: 0,
					lastUser: ""
				};
				interaction.reply(
					"This channel is now being counted. The first number is 1."
				);
			}
		} else {
			data[interaction.guildId] = {
				[interaction.channelId]: {
					count: 0,
					record: 0,
					lastUser: ""
				}
			};
			interaction.reply(
				"This channel is now being counted. The first number is 1."
			);
		}
		save();
	} else if (commandName === "stop") {
		if (data[interaction.guildId] === undefined) {
			return interaction.reply("This channel is not being counted.");
		} else {
			delete data[interaction.guildId][interaction.channelId];
			interaction.reply("This channel is no longer being counted.");
		}
		save();
	}
});

function count(msg: Message) {
	const numberStr = msg.content.match(/^\d+([\s]|$)/);
	const thisData = data[msg.guildId!][msg.channelId];
	if (!numberStr) {
		msg.react("🔤");
		return;
	}
	const number = parseInt(numberStr[0].trim());
	if (number !== thisData.count + 1) {
		msg.react("❌");
		msg.reply(
			`**You failed.** The next number was **${thisData.count + 1}**`
		);
		thisData.lastUser = "";
		thisData.count = 0;
	}
	if (msg.author.id === thisData.lastUser) {
		msg.react("❌");
		thisData.count = 0;
		thisData.lastUser = "";
		return msg.reply(`**You failed.** You can't count twice in a row.`);
	}
	thisData.lastUser = msg.author.id;
	thisData.count++;
	let reaction = "✅";
	if (thisData.count > thisData.record) {
		thisData.record = thisData.count;
		reaction = "☑️";
	}
	if (thisData.count === 69) reaction = "♋";
	if (thisData.count === 100) reaction = "💯";
	if (thisData.count === 420) reaction = "🌿";
	if (thisData.count === 666) reaction = "💀";
	if (thisData.count === 1337) reaction = "💩";
	msg.react(reaction);
}

function save() {
	writeFileSync(join(__dirname, "./data.json"), JSON.stringify(data), "utf8");
}

client.login(token);
