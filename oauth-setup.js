const http = require('http');
const { google } = require('googleapis');
const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
const url = require('url');

const CREDENTIALS_PATH = path.join(__dirname, 'config', 'credentials.json');
const TOKENS_PATH = path.join(__dirname, 'config', 'tokens.json');
const REDIRECT_PORT = 8080;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/oauth2callback`;

async function main() {
  console.log(chalk.cyan.bold('\nYouTube OAuth Setup'));
  console.log(chalk.gray('─'.repeat(50)));

  // Load credentials
  const credsRaw = await fs.readFile(CREDENTIALS_PATH, 'utf8');
  const creds = JSON.parse(credsRaw);
  const { client_id, client_secret } = creds.youtube;

  if (!client_id || client_id === 'YOUR_CLIENT_ID.apps.googleusercontent.com') {
    console.log(chalk.red('No YouTube client_id found in config/credentials.json'));
    process.exit(1);
  }

  // Create OAuth2 client
  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    REDIRECT_URI
  );

  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube',
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/yt-analytics.readonly'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  console.log(chalk.green('\nStarting OAuth callback server on port ' + REDIRECT_PORT));

  // Start server to catch the callback
  const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/oauth2callback') {
      const code = parsedUrl.query.code;
      const error = parsedUrl.query.error;

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<h1>Authorization Failed</h1><p>Error: ${error}</p><p>Close this tab and try again.</p>`);
        console.log(chalk.red(`Authorization error: ${error}`));
        server.close();
        process.exit(1);
      }

      if (code) {
        try {
          const { tokens } = await oauth2Client.getToken(code);
          oauth2Client.setCredentials(tokens);

          // Save tokens
          await fs.writeFile(TOKENS_PATH, JSON.stringify({ youtube: tokens }, null, 2));

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html><body style="font-family:system-ui;text-align:center;padding:50px">
              <h1 style="color:green">Authorization Successful!</h1>
              <p>Tokens saved to config/tokens.json</p>
              <p>You can close this tab and return to the terminal.</p>
            </body></html>
          `);

          console.log(chalk.green.bold('\nAuthorization successful!'));
          console.log(chalk.green('Tokens saved to config/tokens.json'));

          // Test the connection
          console.log(chalk.cyan('\nTesting YouTube API connection...'));
          const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
          const channelRes = await youtube.channels.list({
            part: 'snippet',
            mine: true
          });

          if (channelRes.data.items && channelRes.data.items.length > 0) {
            const channel = channelRes.data.items[0];
            console.log(chalk.green(`Connected to channel: ${channel.snippet.title}`));
          } else {
            console.log(chalk.yellow('No YouTube channel found for this account'));
          }

          server.close();
          process.exit(0);
        } catch (err) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<h1>Token Exchange Failed</h1><p>${err.message}</p>`);
          console.log(chalk.red('Token exchange failed:', err.message));
          server.close();
          process.exit(1);
        }
      }
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(REDIRECT_PORT, () => {
    console.log(chalk.cyan.bold('\nOpen this URL in your browser to authorize:'));
    console.log(chalk.blue.underline(authUrl));
    console.log(chalk.gray('\nWaiting for authorization...'));
  });
}

main().catch(err => {
  console.error(chalk.red('Setup failed:'), err.message);
  process.exit(1);
});
