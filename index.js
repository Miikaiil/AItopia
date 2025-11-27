require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
const cron = require('node-cron');
const axios = require('axios');
const fs = require('fs');
const Parser = require('rss-parser');

const TOKEN      = process.env.TOKEN;
const CLIENT_ID  = process.env.CLIENT_ID;
const CHANNEL_ID = process.env.CHANNEL_ID;
const GUILD_ID   = process.env.GUILD_ID;

const LANGUAGE_FILE = './user_languages.json';

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const parser = new Parser();

// RSS-feeds
const feeds = [
  {
    name: 'FutureTools',
    url: 'https://www.futuretools.io/feed',
    category: { sv: 'FutureTools', en: 'FutureTools' }
  },
  {
    name: 'Matt Wolfe (YouTube)',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCtHaxi4GTYDpJgMSGy7AeSw',
    category: { sv: 'YouTube: Matt Wolfe', en: 'YouTube: Matt Wolfe' }
  },
  {
    name: 'Two Minute Papers (YouTube)',
    url: 'https://www.youtube.com/feeds/videos.xml?channel_id=UCbfYPyITQ-7l4upoX8nvctg',
    category: { sv: 'YouTube: Two Minute Papers', en: 'YouTube: Two Minute Papers' }
  },
  {
    name: 'Reddit r/artificial',
    url: 'https://www.reddit.com/r/artificial/.rss',
    category: { sv: 'Reddit: r/artificial', en: 'Reddit: r/artificial' }
  },
  {
    name: 'SweClockers Nyheter',
    url: 'https://www.sweclockers.com/feeds/news',
    category: { sv: 'SweClockers Nyheter', en: 'SweClockers News' }
  },
  {
    name: 'SweClockers Forum',
    url: 'https://www.sweclockers.com/feeds/forum',
    category: { sv: 'SweClockers Forum', en: 'SweClockers Forum' }
  }
];

// Läs/spara användarspråk
function getUserLanguage(userId) {
  if (!fs.existsSync(LANGUAGE_FILE)) return 'sv';
  const data = JSON.parse(fs.readFileSync(LANGUAGE_FILE));
  return data[userId] || 'sv';
}

function setUserLanguage(userId, lang) {
  let data = {};
  if (fs.existsSync(LANGUAGE_FILE)) {
    data = JSON.parse(fs.readFileSync(LANGUAGE_FILE));
  }
  data[userId] = lang;
  fs.writeFileSync(LANGUAGE_FILE, JSON.stringify(data, null, 2));
}

// Hämta och formattera nyheter
async function fetchNews(lang = 'sv') {
  let news = [];
  for (const feed of feeds) {
    try {
      const parsed = await parser.parseURL(feed.url);
      const items = parsed.items.slice(0, 3); // Ta de 3 senaste per källa
      news.push({
        category: feed.category[lang],
        items: items.map(item => ({
          title: item.title,
          link: item.link,
          date: item.pubDate,
          summary: item.contentSnippet || item.content || ''
        }))
      });
    } catch (e) {
      news.push({
        category: feed.category[lang],
        items: [{ title: lang === 'sv' ? 'Kunde inte hämta nyheter.' : 'Could not fetch news.', link: '', date: '', summary: '' }]
      });
    }
  }
  return news;
}

function formatNews(news, lang = 'sv') {
  let msg = lang === 'sv'
    ? `📰 **Dagens AI-nyheter**\n\n`
    : `📰 **Today's AI News**\n\n`;
  for (const section of news) {
    msg += `__**${section.category}**__\n`;
    for (const item of section.items) {
      msg += `- [${item.title}](${item.link})\n`;
      if (item.summary) msg += `  > ${item.summary.substring(0, 120)}\n`;
    }
    msg += '\n';
  }
  msg += lang === 'sv'
    ? `*Vill du byta språk? Skriv /byt-språk*`
    : `*Want to change language? Use /byt-språk*`;
  return msg;
}

// Slash-kommandon
const commands = [
  {
    name: 'ai-nyheter',
    description: 'Få de senaste AI-nyheterna / Get the latest AI news'
  },
  {
    name: 'byt-språk',
    description: 'Byt språk / Change language',
    options: [
      {
        name: 'språk',
        description: 'Välj språk / Choose language',
        type: 3,
        required: true,
        choices: [
          { name: 'Svenska', value: 'sv' },
          { name: 'English', value: 'en' }
        ]
      }
    ]
  }
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      { body: commands }
    );
    console.log('Slash-kommandon registrerade!');
  } catch (err) {
    console.error(err);
  }
})();

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'ai-nyheter') {
    const lang = getUserLanguage(interaction.user.id);
    await interaction.reply(lang === 'sv'
      ? '🔄 Hämtar AI-nyheter, ett ögonblick...'
      : '🔄 Fetching AI news, please wait...');
    const news = await fetchNews(lang);
    const msg = formatNews(news, lang);
    await interaction.editReply({ content: msg });
  }

  if (interaction.commandName === 'byt-språk') {
    const lang = interaction.options.getString('språk');
    setUserLanguage(interaction.user.id, lang);
    await interaction.reply(lang === 'sv'
      ? 'Språk satt till svenska! 🇸🇪'
      : 'Language set to English! 🇬🇧');
  }
});

// Daglig cron: 08:00 varje dag
cron.schedule('0 8 * * *', async () => {
  const channel = await client.channels.fetch(CHANNEL_ID);
  if (!channel) return;
  // Skicka på svenska och engelska (kan anpassas)
  const news_sv = await fetchNews('sv');
  const news_en = await fetchNews('en');
  await channel.send(formatNews(news_sv, 'sv'));
  await channel.send(formatNews(news_en, 'en'));
});

client.once('ready', () => console.log('Bot är redo!'));
client.login(TOKEN);