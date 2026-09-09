import 'dotenv/config';
import { createHmac } from 'node:crypto';
import {
  CognitoIdentityProviderClient,
  AdminInitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider';

/**
 * Dev diagnostic: call Cognito AdminInitiateAuth directly (bypasses the app's
 * error mapping) to see the REAL result of an admin login attempt.
 *
 * Usage:
 *   npx ts-node src/scripts/check-cognito-login.ts ricardo.delacruz@... 'Admin123!'
 */
async function main(): Promise<void> {
  const username = process.argv[2];
  const password = process.argv[3];
  const poolId = process.env.COGNITO_USER_POOL_ID || '';
  const clientId = process.env.COGNITO_CLIENT_ID || '';
  const clientSecret = process.env.COGNITO_CLIENT_SECRET || '';
  const region =
    process.env.COGNITO_REGION || process.env.AWS_REGION || 'ap-southeast-1';

  console.log('Pool ID  :', poolId);
  console.log('Client ID:', clientId);
  console.log('Secret?  :', clientSecret ? 'yes (in .env)' : 'no');
  console.log('Region   :', region);
  console.log('Username :', username);

  if (!username || !password) {
    console.error('Pass username + password as arguments.');
    process.exit(1);
  }
  if (!poolId || !clientId) {
    console.error('COGNITO_USER_POOL_ID / COGNITO_CLIENT_ID are not set.');
    process.exit(1);
  }

  const client = new CognitoIdentityProviderClient({ region });
  try {
    const res = await client.send(
      new AdminInitiateAuthCommand({
        UserPoolId: poolId,
        ClientId: clientId,
        AuthFlow: 'ADMIN_USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: username,
          PASSWORD: password,
          ...(clientSecret
            ? {
                SECRET_HASH: createHmac('sha256', clientSecret)
                  .update(username + clientId)
                  .digest('base64'),
              }
            : {}),
        },
      })
    );
    console.log(
      '>>> SUCCESS. ChallengeName =',
      res.ChallengeName ?? '(none — tokens returned directly)',
      '| has session:', res.Session ? 'yes' : 'no'
    );
  } catch (err) {
    const e = err as { name?: string; message?: string };
    console.log('>>> ERROR name   :', e?.name);
    console.log('>>> ERROR message:', e?.message);
  }
}

main();
