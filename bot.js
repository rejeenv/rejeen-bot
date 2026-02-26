import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;
const SITE_URL = process.env.SITE_URL || 'https://rejeen.xyz';

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
  .addStringOption(opt =>
    opt.setName('typ')
      .setDescription('Typ zamówienia')
      .setRequired(true)
      .addChoices(
        { name: '🎮 Rockstar', value: 'rockstar' },
        { name: '🎮 Steam', value: 'steam' },
        { name: '💬 Discord', value: 'discord' },
      )
  )
  .addUserOption(opt =>
    opt.setName('uzytkownik')
      .setDescription('Klient (@user)')
      .setRequired(true)
  )
  .addStringOption(opt => opt.setName('email1').setDescription('Rockstar/Steam: Email 1').setRequired(false))
  .addStringOption(opt => opt.setName('haslo1').setDescription('Rockstar/Steam: Hasło 1').setRequired(false))
  .addStringOption(opt => opt.setName('klucz1').setDescription('Rockstar: Klucz 2FA 1').setRequired(false))
  .addStringOption(opt => opt.setName('email2').setDescription('Rockstar/Steam: Email 2').setRequired(false))
  .addStringOption(opt => opt.setName('haslo2').setDescription('Rockstar/Steam: Hasło 2').setRequired(false))
  .addStringOption(opt => opt.setName('klucz2').setDescription('Rockstar: Klucz 2FA 2').setRequired(false))
  .addStringOption(opt => opt.setName('email3').setDescription('Rockstar/Steam: Email 3').setRequired(false))
  .addStringOption(opt => opt.setName('haslo3').setDescription('Rockstar/Steam: Hasło 3').setRequired(false))
  .addStringOption(opt => opt.setName('klucz3').setDescription('Rockstar: Klucz 2FA 3').setRequired(false))
  .addStringOption(opt => opt.setName('email4').setDescription('Rockstar/Steam: Email 4').setRequired(false))
  .addStringOption(opt => opt.setName('haslo4').setDescription('Rockstar/Steam: Hasło 4').setRequired(false))
  .addStringOption(opt => opt.setName('klucz4').setDescription('Rockstar: Klucz 2FA 4').setRequired(false))
  .addStringOption(opt => opt.setName('email5').setDescription('Rockstar/Steam: Email 5').setRequired(false))
  .addStringOption(opt => opt.setName('haslo5').setDescription('Rockstar/Steam: Hasło 5').setRequired(false))
  .addStringOption(opt => opt.setName('klucz5').setDescription('Rockstar: Klucz 2FA 5').setRequired(false))
  .addStringOption(opt => opt.setName('token1').setDescription('Discord: Token 1').setRequired(false))
  .addStringOption(opt => opt.setName('token2').setDescription('Discord: Token 2').setRequired(false))
  .addStringOption(opt => opt.setName('token3').setDescription('Discord: Token 3').setRequired(false))
  .addStringOption(opt => opt.setName('token4').setDescription('Discord: Token 4').setRequired(false))
  .addStringOption(opt => opt.setName('token5').setDescription('Discord: Token 5').setRequired(false))
  .addStringOption(opt => opt.setName('token6').setDescription('Discord: Token 6').setRequired(false))
  .addStringOption(opt => opt.setName('token7').setDescription('Discord: Token 7').setRequired(false))
  .addStringOption(opt => opt.setName('token8').setDescription('Discord: Token 8').setRequired(false));

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

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommand() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: [commandRejeen.toJSON(), commandUsun.toJSON(), commandZamowienia.toJSON(), commandComet.toJSON()] }
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
  if (!interaction.isChatInputCommand()) return;

  if (interaction.guildId !== process.env.DISCORD_GUILD_ID) {
    return interaction.reply({ content: '❌ Bot działa tylko na oficjalnym serwerze.', ephemeral: true });
  }

  const member = interaction.member;
  if (!member.roles.cache.has(process.env.DISCORD_ADMIN_ROLE_ID)) {
    return interaction.reply({ content: '❌ Nie masz uprawnień do tej komendy.', ephemeral: true });
  }

  // ── /rejeen ──────────────────────────────────────────────────────────────
  if (interaction.commandName === 'rejeen') {
    const typ = interaction.options.getString('typ');
    const user = interaction.options.getUser('uzytkownik');
    const typeLabels = { rockstar: '🎮 Rockstar', steam: '🎮 Steam', discord: '💬 Discord' };

    let orderData = {
      typ,
      userId: user.id,
      username: user.username,
      createdBy: interaction.user.username,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + EXPIRE_SECONDS * 1000).toISOString(),
    };

    if (typ === 'discord') {
      const tokeny = [];
      for (let i = 1; i <= 8; i++) {
        const t = interaction.options.getString(`token${i}`);
        if (t) tokeny.push(t);
      }
      if (tokeny.length === 0) {
        return interaction.reply({ content: '❌ Podaj przynajmniej jeden token.', ephemeral: true });
      }
      orderData.tokeny = tokeny;

    } else if (typ === 'rockstar') {
      const konta = [];
      for (let i = 1; i <= 5; i++) {
        const email = interaction.options.getString(`email${i}`);
        const haslo = interaction.options.getString(`haslo${i}`);
        const klucz = interaction.options.getString(`klucz${i}`);
        if (email && haslo && klucz) konta.push({ email, haslo, klucz });
      }
      if (konta.length === 0) {
        return interaction.reply({ content: '❌ Podaj przynajmniej jedno konto (email + hasło + klucz 2FA).', ephemeral: true });
      }
      orderData.konta = konta;

    } else if (typ === 'steam') {
      const konta = [];
      for (let i = 1; i <= 5; i++) {
        const email = interaction.options.getString(`email${i}`);
        const haslo = interaction.options.getString(`haslo${i}`);
        if (email && haslo) konta.push({ email, haslo });
      }
      if (konta.length === 0) {
        return interaction.reply({ content: '❌ Podaj przynajmniej jedno konto (email + hasło).', ephemeral: true });
      }
      orderData.konta = konta;
    }

    const orderId = Date.now().toString();
    const orderUrl = `${SITE_URL}/customer/${orderId}`;
    await redisSet(`order:${orderId}`, orderData);

    const channelEmbed = new EmbedBuilder()
      .setColor(0xc8ff00)
      .setTitle(`Zamówienie #${orderId}`)
      .setDescription(`Zamówienie dla ${user} zostało utworzone.`)
      .addFields(
        { name: 'Typ', value: typeLabels[typ], inline: true },
        { name: 'Klient', value: user.username, inline: true },
        { name: 'Link', value: orderUrl },
        { name: 'Wygasa', value: 'za 3 dni', inline: true },
      )
      .setFooter({ text: `Utworzone przez ${interaction.user.username}` })
      .setTimestamp();

    await interaction.reply({ embeds: [channelEmbed] });

    try {
      const dmEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Twoje zamówienie jest gotowe!')
        .setDescription(`Hej ${user.username}! Twoje zamówienie w **REJEEN STORE** jest gotowe do odbioru.`)
        .addFields(
          { name: 'Typ', value: typeLabels[typ], inline: true },
          { name: 'Link do zamówienia', value: orderUrl },
          { name: '⚠️ Uwaga', value: 'Link wygasa za **3 dni**. Zaloguj się przez Discord aby zobaczyć dane.' },
        )
        .setTimestamp();
      await user.send({ embeds: [dmEmbed] });
    } catch (e) {
      await interaction.followUp({
        content: `⚠️ Nie mogłem wysłać DM do ${user} (zablokowane wiadomości). Link: ${orderUrl}`,
        ephemeral: true,
      });
    }
  }

  // ── /usun ─────────────────────────────────────────────────────────────────
  if (interaction.commandName === 'usun') {
    const orderId = interaction.options.getString('orderid');
    const order = await redisGet(`order:${orderId}`);

    if (!order) {
      return interaction.reply({ content: `❌ Zamówienie \`${orderId}\` nie istnieje.`, ephemeral: true });
    }

    await redisDel(`order:${orderId}`);
    return interaction.reply({ content: `✅ Zamówienie \`${orderId}\` zostało usunięte.`, ephemeral: true });
  }

  // ── /zamowienia ───────────────────────────────────────────────────────────
  if (interaction.commandName === 'zamowienia') {
    await interaction.deferReply({ ephemeral: true });

    const keys = await redisKeys('order:*');

    if (keys.length === 0) {
      return interaction.editReply({ content: '📭 Brak aktywnych zamówień.' });
    }

    const typeLabels = { rockstar: '🎮 Rockstar', steam: '🎮 Steam', discord: '💬 Discord' };
    const orders = [];

    for (const key of keys) {
      const order = await redisGet(key);
      if (order) {
        const orderId = key.replace('order:', '');
        orders.push({ orderId, ...order });
      }
    }

    orders.sort((a, b) => b.orderId - a.orderId);

    const embed = new EmbedBuilder()
      .setColor(0xc8ff00)
      .setTitle(`📦 Aktywne zamówienia (${orders.length})`)
      .setTimestamp();

    const lines = orders.map(o => {
      const typ = typeLabels[o.typ] || o.typ;
      const expiresAt = new Date(o.expiresAt);
      const diff = expiresAt - new Date();
      const daysLeft = Math.floor(diff / 1000 / 60 / 60 / 24);
      const hoursLeft = Math.floor(diff / 1000 / 60 / 60);
      const timeStr = daysLeft > 0 ? `${daysLeft}d` : `${hoursLeft}h`;
      return `**#${o.orderId}** • ${typ} • <@${o.userId}> (${o.username}) • wygasa za ${timeStr}`;
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

    embed.setDescription(chunks[0]);
    return interaction.editReply({ embeds: [embed] });
  }

  // ── /comet ────────────────────────────────────────────────────────────────
  if (interaction.commandName === 'comet') {
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
        return interaction.reply({ content: '❌ Błąd aktualizacji kodu.', ephemeral: true });
      }
    } catch(e) {
      return interaction.reply({ content: `❌ Błąd: ${e.message}`, ephemeral: true });
    }
  }
});

await registerCommand();
client.login(TOKEN);
