import discord
import requests
import datetime

TOKEN = 'MTQ0MzY5MjMxODc1MzQyNzQ5MA.GVMB_T.XVAhdVxQeJwHvnCYgE1rDg43JtDgf0DmJ-Xmsk'
TRIFORM_URL = 'https://nexus.triform.ai/api/in/fcf7cdf7-1bf8-44e8-b33a-04ab94f22203/01b37cf3-6acb-45a5-af9d-c9988a17138e'

intents = discord.Intents.default()
client = discord.Client(intents=intents)

@client.event
async def on_message(message):
    if message.author.bot:
        return

    if message.content.startswith('!ainews'):
        try:
            _, genre, format = message.content.split(' ', 2)
        except ValueError:
            await message.channel.send("Använd: !ainews <genre> <format>")
            return

        since = (datetime.datetime.utcnow() - datetime.timedelta(days=1)).isoformat() + "Z"
        payload = {"genre": genre, "format": format, "since": since}
        headers = {
            "Content-Type": "application/json",
            "Authorization": "Bearer 9e90c614d2c5fb9ca8e1e89483c71f5cd2ebf8cc"
        }
        response = requests.post(TRIFORM_URL, json=payload, headers=headers)
        if response.ok:
            data = response.json()
            summary = data.get('summary_text', 'Inget svar')
            sources = '\n'.join(data.get('source_list', []))
            await message.channel.send(f"{summary}\n\nKällor:\n{sources or '–'}")
        else:
            await message.channel.send("Fel vid hämtning av nyheter.")

client.run(TOKEN)