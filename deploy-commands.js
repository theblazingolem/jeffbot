const { REST, Routes } = require("discord.js");
require('dotenv').config();
// const { clientId, token } = require('./config.json');
const token = process.env.TOKEN;
const clientId = process.env.CLIENTID;
const fs = require("node:fs");
const path = require("node:path");

// Arrays to hold different types of commands
const globalCommands = [];
const guildCommands = new Map(); // Map to store commands for specific guilds

// Grab all the command folders from the commands directory you created earlier
const foldersPath = path.join(__dirname, "commands");
const commandFolders = fs.readdirSync(foldersPath).filter(folder => {
    const folderPath = path.join(foldersPath, folder);
    return fs.statSync(folderPath).isDirectory(); // Only include directories
});

for (const folder of commandFolders) {
    // Grab all the command files from the commands directory you created earlier
    const commandsPath = path.join(foldersPath, folder);
    const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith(".js"));
    // Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        if ("data" in command && "execute" in command) {
            // Check if it's a guild command
            if (command.guildCommand && command.guildId) {
                // Initialize array for this guild if it doesn't exist
                if (!guildCommands.has(command.guildId)) {
                    guildCommands.set(command.guildId, []);
                }
                // Add command to the guild array
                guildCommands.get(command.guildId).push(command.data.toJSON());
                console.log(
                    `[INFO] Command ${command.data.name} registered for guild ${command.guildId}`
                );
            } else {
                // Global command
                globalCommands.push(command.data.toJSON());
            }
        } else {
            console.log(
                `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`
            );
        }
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST({ version: "10" }).setToken(token);

// and deploy your commands!
(async () => {
    try {
        // Deploy global commands
        if (globalCommands.length > 0) {
            console.log(
                `Started refreshing ${globalCommands.length} global application (/) commands.`
            );
            const globalData = await rest.put(
                Routes.applicationCommands(clientId),
                { body: globalCommands }
            );
            console.log(
                `Successfully reloaded ${globalData.length} global application (/) commands.`
            );
        } else {
            console.log("No global commands to deploy.");
        }

        // Deploy guild commands
        for (const [guildId, commands] of guildCommands.entries()) {
            if (commands.length > 0) {
                console.log(
                    `Started refreshing ${commands.length} guild-specific commands for guild ${guildId}`
                );
                const guildData = await rest.put(
                    Routes.applicationGuildCommands(clientId, guildId),
                    { body: commands }
                );
                console.log(
                    `Successfully reloaded ${guildData.length} guild-specific commands for guild ${guildId}`
                );
            }
        }
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();
