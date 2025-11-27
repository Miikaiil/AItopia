require('dotenv').config();

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const cron = require('node-cron');
const axios = require('axios');

const TOKEN      = process.env.TOKEN;
const CLIENT_ID  = process.env.CLIENT_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GUILD_ID   = process.env.GUILD_ID;

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function getAiNews(genre, format) {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const payload = { genre, format, since };
    console.log("Payload:", payload);

    const { data } = await axios.post(
      'https://nexus.triform.ai/api/in/fcf7cdf7-1bf8-44e8-b33a-04ab94f22203/01b37cf3-6acb-45a5-af9d-c9988a17138e',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer 9e90c614d2c5fb9ca8e1e89483c71f5cd2ebf8cc'
        },
        timeout: 120000
      }
    );
    console.log("Svar från Triform:", data);

    const summary = data.result?.summary_text || 'Inga nya AI-nyheter senaste dygnet.';
    const sources = (data.result?.source_list || []).join('\n');
    return {
      response: `${summary}\n\nKällor:\n${sources || '–'}`
    };
  } catch (err) {
    console.error('Nyhetsfel:', err.message);
    return { response: 'Kunde inte hämta nyheter just nu.' };
  }
}

const commands = [
  {
    name: 'ai-nyheter',
    description: 'Få de senaste AI-nyheterna',
    options: [
      {
        name: 'genre',
        type: 3,
        description: 'Välj genre',
        required: true,
        choices: [
          { name: 'Alla AI-nyheter', value: 'Alla AI-nyheter' },
          { name: 'Generativ AI', value: 'Generativ AI' },
          { name: 'Plattformar som Triform', value: 'Plattformar som Triform' },
          { name: 'Influencer-sammanfattningar', value: 'Influencer-sammanfattningar' }
        ]
      },
      {
        name: 'format',
        type: 3,
        description: 'Välj format',
        required: true,
        choices: [
          { name: 'Highlights', value: 'Highlights' },
          { name: 'Lång sammanfattning', value: 'Lång sammanfattning' },
          { name: 'Endast länkar', value: 'Endast länkar' }
        ]
      }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    console.log('Registrerar guild-kommandon...');
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Kommandon registrerade!');
  } catch (err) {
    console.error(err);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== 'ai-nyheter') return;

  await interaction.reply({ content: "🔄 Hämtar AI-nyheter, detta kan ta upp till en minut..." });

  const genre  = interaction.options.getString('genre');
  const format = interaction.options.getString('format');

  const result = await getAiNews(genre, format);

  await interaction.editReply({ content: result.response });
});

cron.schedule('0 8 * * *', async () => {
  try {
    const result = await getAiNews('Alla AI-nyheter', 'Highlights');
    const channel = await client.channels.fetch(CHANNEL_ID);
    if (channel) await channel.send(result.response);
  } catch (e) {
    console.error('Dagligt nyhetsfel:', e);
  }
});

client.once('clientReady', () => console.log('Bot är redo!'));
client.login(TOKEN);