import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const REDIS_URL = process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN;

console.log('TOKEN present:', !!TOKEN, '| length:', TOKEN?.length);
console.log('CLIENT_ID present:', !!CLIENT_ID);
console.log('REDIS_URL present:', !!REDIS_URL);

const SITE_URL = 'https://rejeen.xyz';
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
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
    },
  });
}

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
  .addStringOption(opt =>
    opt.setName('login')
      .setDescription('Login / Email (Rockstar, Steam)')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt.setName('haslo')
      .setDescription('Hasło (Rockstar, Steam)')
      .setRequired(false)
  )
  .addStringOption(opt =>
    opt.setName('klucz')
      .setDescription('Klucz 2FA (Rockstar, Discord)')
      .setRequired(false)
  );

const commandUsun = new SlashCommandBuilder()
  .setName('usun')
  .setDescription('Usuń zamówienie')
  .addStringOption(opt =>
    opt.setName('orderid')
      .setDescription('ID zamówienia')
      .setRequired(true)
  );

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function registerCommand() {
  try {
    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, process.env.DISCORD_GUILD_ID),
      { body: [commandRejeen.toJSON(), commandUsun.toJSON()] }
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

  // Sprawdź czy to właściwy serwer
  if (interaction.guildId !== process.env.DISCORD_GUILD_ID) {
    return interaction.reply({ content: '❌ Bot działa tylko na oficjalnym serwerze.', ephemeral: true });
  }

  // Sprawdź czy użytkownik ma rolę admina
  const member = interaction.member;
  if (!member.roles.cache.has(process.env.DISCORD_ADMIN_ROLE_ID)) {
    return interaction.reply({ content: '❌ Nie masz uprawnień do tej komendy.', ephemeral: true });
  }

  // ── /rejeen ──────────────────────────────────────────────────────────────
  if (interaction.commandName === 'rejeen') {
    const typ = interaction.options.getString('typ');
    const user = interaction.options.getUser('uzytkownik');
    const login = interaction.options.getString('login');
    const haslo = interaction.options.getString('haslo');
    const klucz = interaction.options.getString('klucz');

    const errors = [];
    if (typ === 'rockstar') {
      if (!login) errors.push('Brak loginu/emaila');
      if (!haslo) errors.push('Brak hasła');
      if (!klucz) errors.push('Brak klucza 2FA');
    } else if (typ === 'steam') {
      if (!login) errors.push('Brak loginu');
      if (!haslo) errors.push('Brak hasła');
    } else if (typ === 'discord') {
      if (!klucz) errors.push('Brak klucza');
    }

    if (errors.length > 0) {
      return interaction.reply({ content: `❌ Błąd: ${errors.join(', ')}`, ephemeral: true });
    }

    const orderId = Date.now().toString();
    const orderUrl = `${SITE_URL}/customer/${orderId}`;

    const orderData = {
      typ,
      userId: user.id,
      username: user.username,
      createdBy: interaction.user.username,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + EXPIRE_SECONDS * 1000).toISOString(),
      ...(login && { login }),
      ...(haslo && { haslo }),
      ...(klucz && { klucz }),
    };

    await redisSet(`order:${orderId}`, orderData);

    const typeLabels = { rockstar: '🎮 Rockstar', steam: '🎮 Steam', discord: '💬 Discord' };

    const channelEmbed = new EmbedBuilder()
      .setColor(0xc8ff00)
      .setTitle(`Zamówienie #${orderId}`)
      .setDescription(`Zamówienie dla ${user} zostało utworzone.`)
      .addFields(
        { name: 'Typ', value: typeLabels[typ], inline: true },
        { name: 'Klient', value: `${user.username}`, inline: true },
        { name: 'Link', value: orderUrl },
        { name: 'Wygasa', value: `za 3 dni`, inline: true },
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

    // Sprawdź czy zamówienie istnieje
    const redisRes = await fetch(`${REDIS_URL}/get/order:${orderId}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
    const redisData = await redisRes.json();
    const rawValue = redisData.result ?? redisData.value;

    if (!rawValue) {
      return interaction.reply({ content: `❌ Zamówienie \`${orderId}\` nie istnieje.`, ephemeral: true });
    }

    await redisDel(`order:${orderId}`);

    return interaction.reply({
      content: `✅ Zamówienie \`${orderId}\` zostało usunięte.`,
      ephemeral: true,
    });
  }
});

await registerCommand();
client.login(TOKEN);
