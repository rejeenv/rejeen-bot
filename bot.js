import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;
const SITE_URL = process.env.SITE_URL || 'https://www.rejeen.xyz';

console.log('TOKEN present:', !!TOKEN, '| length:', TOKEN?.length);
console.log('CLIENT_ID present:', !!CLIENT_ID);
console.log('REDIS_URL present:', !!REDIS_URL);

const EXPIRE_SECONDS = 60 * 60 * 24 * 3;

async function redisSet(key, value) {
  await fetch(`${REDIS_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value: JSON.stringify(value), ex: EXPIRE_SECONDS }),
  });
}

async function redisDel(key) {
  await fetch(`${REDIS_URL}/del/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
}

async function redisGet(key) {
  const res = await fetch(`${REDIS_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  const rawValue = data.result ?? data.value;
  if (!rawValue) return null;
  if (typeof rawValue === 'string') {
    try {
      const parsed = JSON.parse(rawValue);
      if (parsed.value !== undefined) return JSON.parse(parsed.value);
      return parsed;
    } catch(e) {}
  }
  return rawValue;
}

async function redisKeys(pattern) {
  const res = await fetch(`${REDIS_URL}/keys/${pattern}`, {
    headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
  });
  const data = await res.json();
  return data.result || [];
}

// ── Komendy ──────────────────────────────────────────────────────────────────

const commandRejeen = new SlashCommandBuilder()
  .setName('rejeen')
  .setDescription('Utwórz zamówienie dla klienta')
  .addUserOption(opt =>
    opt.setName('uzytkownik')
      .setDescription('Klient (@user)')
      .setRequired(true)
  );

const commandUsun = new SlashCommandBuilder()
  .setName('usun')
  .setDescription('Usuń zamówienie')
  .addStringOption(opt =>
    opt.setName('orderid')
      .setDescription('ID zamówienia')
      .setRequired(true)
  );

const commandZamowienia = new SlashCommandBuilder()
  .setName('zamowienia')
  .setDescription('Pokaż listę aktywnych zamówień');

const commandComet = new SlashCommandBuilder()
  .setName('comet')
  .setDescription('Ustaw kod invite dla comet.lua')
  .addStringOption(opt =>
    opt.setName('code')
      .setDescription('Nowy kod invite')
      .setRequired(true)
  );

const commandTeststat = new SlashCommandBuilder()
  .setName('teststat')
  .setDescription('Testuj endpoint statystyk');

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommand() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: [commandRejeen.toJSON(), commandUsun.toJSON(), commandZamowienia.toJSON(), commandComet.toJSON(), commandTeststat.toJSON()] }
    );
    console.log('✅ Komendy zarejestrowane');
  } catch (err) {
    console.error('Błąd rejestracji komendy:', err);
  }
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', () => {
  console.log(`✅ Bot zalogowany jako ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {

  if (interaction.isChatInputCommand()) {
    if (interaction.guildId !== process.env.DISCORD_GUILD_ID) {
      return interaction.reply({ content: '❌ Bot działa tylko na oficjalnym serwerze.', ephemeral: true });
    }
    if (!interaction.member.roles.cache.has(process.env.DISCORD_ADMIN_ROLE_ID)) {
      return interaction.reply({ content: '❌ Nie masz uprawnień do tej komendy.', ephemeral: true });
    }
  }

  // ── /rejeen ───────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'rejeen') {
    const user = interaction.options.getUser('uzytkownik');

    const modal = new ModalBuilder()
      .setCustomId(`rejeen_modal_${user.id}_${user.username}`)
      .setTitle(`Zamówienie dla ${user.username}`);

    const rockstarInput = new TextInputBuilder()
      .setCustomId('rockstar')
      .setLabel('Rockstar: email:haslo:2fa')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('email@gmail.com:haslo123:klucz2fa\nemail2@gmail.com:haslo456:klucz2fa2')
      .setRequired(false);

    const steamInput = new TextInputBuilder()
      .setCustomId('steam')
      .setLabel('Steam: email:haslo')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('email@gmail.com:haslo123\nemail2@gmail.com:haslo456')
      .setRequired(false);

    const discordInput = new TextInputBuilder()
      .setCustomId('discord')
      .setLabel('Discord: tokeny (każdy w nowej linii)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('token1\ntoken2\ntoken3')
      .setRequired(false);

    modal.addComponents(
      new ActionRowBuilder().addComponents(rockstarInput),
      new ActionRowBuilder().addComponents(steamInput),
      new ActionRowBuilder().addComponents(discordInput),
    );

    return interaction.showModal(modal);
  }

  // ── Modal submit ──────────────────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('rejeen_modal_')) {
    await interaction.deferReply({ ephemeral: false });

    const parts = interaction.customId.split('_');
    const userId = parts[2];
    const username = parts.slice(3).join('_');

    const rockstarRaw = interaction.fields.getTextInputValue('rockstar').trim();
    const steamRaw = interaction.fields.getTextInputValue('steam').trim();
    const discordRaw = interaction.fields.getTextInputValue('discord').trim();

    if (!rockstarRaw && !steamRaw && !discordRaw) {
      return interaction.editReply({ content: '❌ Wypełnij przynajmniej jedno pole.' });
    }

    const rockstarKonta = [];
    if (rockstarRaw) {
      for (const line of rockstarRaw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const [email, haslo, klucz] = trimmed.split(':');
        if (email && haslo && klucz) {
          rockstarKonta.push({ email: email.trim(), haslo: haslo.trim(), klucz: klucz.trim() });
        } else {
          return interaction.editReply({ content: `❌ Błędny format Rockstar: \`${trimmed}\`\nPowinno być: email:haslo:2fa` });
        }
      }
    }

    const steamKonta = [];
    if (steamRaw) {
      for (const line of steamRaw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const [email, haslo] = trimmed.split(':');
        if (email && haslo) {
          steamKonta.push({ email: email.trim(), haslo: haslo.trim() });
        } else {
          return interaction.editReply({ content: `❌ Błędny format Steam: \`${trimmed}\`\nPowinno być: email:haslo` });
        }
      }
    }

    const discordTokeny = [];
    if (discordRaw) {
      for (const line of discordRaw.split('\n')) {
        const trimmed = line.trim();
        if (trimmed) discordTokeny.push(trimmed);
      }
    }

    const orderData = {
      userId,
      username,
      createdBy: interaction.user.username,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + EXPIRE_SECONDS * 1000).toISOString(),
      ...(rockstarKonta.length > 0 && { rockstar: rockstarKonta }),
      ...(steamKonta.length > 0 && { steam: steamKonta }),
      ...(discordTokeny.length > 0 && { discord: discordTokeny }),
    };

    const orderId = Date.now().toString();
    const orderUrl = `${SITE_URL}/customer/${orderId}`;
    await redisSet(`order:${orderId}`, orderData);

    const summary = [];
    if (rockstarKonta.length > 0) summary.push(`🎮 Rockstar: ${rockstarKonta.length} konto/kont`);
    if (steamKonta.length > 0) summary.push(`🎮 Steam: ${steamKonta.length} konto/kont`);
    if (discordTokeny.length > 0) summary.push(`💬 Discord: ${discordTokeny.length} token/tokenów`);

    const channelEmbed = new EmbedBuilder()
      .setColor(0xc8ff00)
      .setTitle(`Zamówienie #${orderId}`)
      .setDescription(`Zamówienie dla <@${userId}> zostało utworzone.`)
      .addFields(
        { name: 'Zawartość', value: summary.join('\n'), inline: false },
        { name: 'Link', value: orderUrl },
        { name: 'Wygasa', value: 'za 3 dni', inline: true },
      )
      .setFooter({ text: `Utworzone przez ${interaction.user.username}` })
      .setTimestamp();

    await interaction.editReply({ embeds: [channelEmbed] });

    try {
      const user = await client.users.fetch(userId);
      const dmEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Twoje zamówienie jest gotowe!')
        .setDescription(`Hej ${username}! Twoje zamówienie w **REJEEN STORE** jest gotowe do odbioru.`)
        .addFields(
          { name: 'Zawartość', value: summary.join('\n') },
          { name: 'Link do zamówienia', value: orderUrl },
          { name: '⚠️ Uwaga', value: 'Link wygasa za **3 dni**. Zaloguj się przez Discord aby zobaczyć dane.' },
        )
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
    } catch(e) {
      await interaction.followUp({
        content: `⚠️ Nie mogłem wysłać DM do <@${userId}> (zablokowane wiadomości). Link: ${orderUrl}`,
        ephemeral: true,
      });
    }
  }

  // ── /usun ─────────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'usun') {
    const orderId = interaction.options.getString('orderid');
    const order = await redisGet(`order:${orderId}`);

    if (!order) {
      return interaction.reply({ content: `❌ Zamówienie \`${orderId}\` nie istnieje.`, ephemeral: true });
    }

    await redisDel(`order:${orderId}`);
    return interaction.reply({ content: `✅ Zamówienie \`${orderId}\` zostało usunięte.`, ephemeral: true });
  }

  // ── /zamowienia ───────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'zamowienia') {
    await interaction.deferReply({ ephemeral: true });

    const keys = await redisKeys('order:*');

    if (keys.length === 0) {
      return interaction.editReply({ content: '📭 Brak aktywnych zamówień.' });
    }

    const orders = [];
    for (const key of keys) {
      const order = await redisGet(key);
      if (order) {
        const orderId = key.replace('order:', '');
        orders.push({ orderId, ...order });
      }
    }

    orders.sort((a, b) => b.orderId - a.orderId);

    const lines = orders.map(o => {
      const parts = [];
      if (o.rockstar) parts.push(`🎮R:${o.rockstar.length}`);
      if (o.steam) parts.push(`🎮S:${o.steam.length}`);
      if (o.discord) parts.push(`💬D:${o.discord.length}`);
      if (o.typ) parts.push({ rockstar: '🎮 Rockstar', steam: '🎮 Steam', discord: '💬 Discord' }[o.typ] || o.typ);

      const expiresAt = new Date(o.expiresAt);
      const diff = expiresAt - new Date();
      const daysLeft = Math.floor(diff / 1000 / 60 / 60 / 24);
      const hoursLeft = Math.floor(diff / 1000 / 60 / 60);
      const timeStr = daysLeft > 0 ? `${daysLeft}d` : `${hoursLeft}h`;
      return `**#${o.orderId}** • ${parts.join(' ')} • <@${o.userId}> (${o.username}) • za ${timeStr}`;
    });

    let current = '';
    const chunks = [];
    for (const line of lines) {
      if ((current + '\n' + line).length > 4000) {
        chunks.push(current);
        current = line;
      } else {
        current = current ? current + '\n' + line : line;
      }
    }
    if (current) chunks.push(current);

    const embed = new EmbedBuilder()
      .setColor(0xc8ff00)
      .setTitle(`📦 Aktywne zamówienia (${orders.length})`)
      .setDescription(chunks[0])
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  }

  // ── /comet ────────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'comet') {
    const code = interaction.options.getString('code');

    try {
      const res = await fetch(`${SITE_URL}/api/comet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bot-secret': process.env.BOT_SECRET,
        },
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        return interaction.reply({ content: `✅ Kod comet.lua zaktualizowany na: \`${code}\``, ephemeral: true });
      } else {
        const data = await res.json();
        return interaction.reply({ content: `❌ Błąd: ${JSON.stringify(data)}`, ephemeral: true });
      }
    } catch(e) {
      return interaction.reply({ content: `❌ Błąd fetch: ${e.message}`, ephemeral: true });
    }
  }

  // ── /teststat ─────────────────────────────────────────────────────────────
  if (interaction.isChatInputCommand() && interaction.commandName === 'teststat') {
    try {
      const res = await fetch(`${SITE_URL}/api/stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: process.env.BOT_SECRET, event: 'launch' }),
      });
      const data = await res.json();
      return interaction.reply({ content: `Status: ${res.status} | Odpowiedź: ${JSON.stringify(data)} | SITE_URL: ${SITE_URL} | BOT_SECRET present: ${!!process.env.BOT_SECRET}`, ephemeral: true });
    } catch(e) {
      return interaction.reply({ content: `❌ Błąd: ${e.message}`, ephemeral: true });
    }
  }
});

await registerCommand();
client.login(TOKEN);
