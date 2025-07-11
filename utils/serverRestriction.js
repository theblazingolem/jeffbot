/**
 * Server restriction utility for commands
 * Provides functions to check if commands should be restricted to specific servers
 */

const { MessageFlags, PermissionFlagsBits } = require("discord.js");
const ownerId = process.env.OWNERID;
// require('../config.json');

// The server ID where restricted commands are allowed
const ALLOWED_SERVER_ID = "841699180271239218";

// Commands that are allowed in any server for everyone
const UNRESTRICTED_COMMANDS = ["echo", "ianquote", "join", "invite"];

// Commands that can only be used by admins in any server
const ADMIN_EVERYWHERE_COMMANDS = ["reload"];

// Commands that can only be used by admins in the allowed server
const ADMIN_SPECIFIC_SERVER_COMMANDS = ["servers"];

// Commands that can be used by everyone in the allowed server
const USER_SPECIFIC_SERVER_COMMANDS = [];

/**
 * Checks if a command should be restricted based on the server, command name, and user permissions
 * @param {Interaction} interaction - The Discord interaction object
 * @returns {boolean} True if the command execution should continue, false if it's restricted and replied to
 */
function checkServerRestriction(interaction) {
    const commandName = interaction.commandName;
    const isAdmin =
        interaction.member?.permissions?.has(
            PermissionFlagsBits.Administrator
        ) || false;
    const isAllowedServer = interaction.guildId === ALLOWED_SERVER_ID;

    // Allow the bot owner to use any command anywhere
    if (interaction.user.id === ownerId) {
        return true;
    }

    // Commands that are allowed in any server for everyone
    if (UNRESTRICTED_COMMANDS.includes(commandName)) {
        return true;
    }

    // Commands that can only be used by admins in any server
    if (ADMIN_EVERYWHERE_COMMANDS.includes(commandName)) {
        if (isAdmin) {
            return true;
        } else {
            interaction.reply({
                content: "This command can only be used by administrators.",
                flags: MessageFlags.Ephemeral,
            });
            return false;
        }
    }

    // First check if we're in the allowed server
    if (!isAllowedServer) {
        interaction.reply({
            content:
                "This command can only be used in this server: https://discord.gg/U2SqD5nxsT",
            flags: MessageFlags.Ephemeral,
        });
        return false;
    }

    // Commands that can only be used by admins in the allowed server
    if (ADMIN_SPECIFIC_SERVER_COMMANDS.includes(commandName)) {
        if (isAdmin) {
            return true;
        } else {
            interaction.reply({
                content: "This command can only be used by administrators.",
                flags: MessageFlags.Ephemeral,
            });
            return false;
        }
    }

    // Commands that can be used by everyone in the allowed server
    if (USER_SPECIFIC_SERVER_COMMANDS.includes(commandName)) {
        return true;
    }

    // If we got here, default to allowing the command in the allowed server
    return true;
}

module.exports = {
    checkServerRestriction,
    ALLOWED_SERVER_ID,
    UNRESTRICTED_COMMANDS,
    ADMIN_EVERYWHERE_COMMANDS,
    ADMIN_SPECIFIC_SERVER_COMMANDS,
    USER_SPECIFIC_SERVER_COMMANDS,
};
