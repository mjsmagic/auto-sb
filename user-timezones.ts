import { WebClient, ErrorCode } from '@slack/web-api';

// Create a WebClient instance with the Slack API token
const client = new WebClient(process.env.SLACK_API_TOKEN);

// Call the users.list API method to get a list of all users
const getUsers = async () => {
  try {
    const response = await client.users.list();
    return response.members;
  } catch (error) {
    if (error.code === ErrorCode.WebAPIError && error.data.error === 'invalid_auth') {
      console.log('Error: Invalid credentials.');
    } else {
      console.log(`Error: ${error.message}`);
    }
  }
};

// Loop through the list of users and retrieve their timezones
const getTimezones = async () => {
  const users = await getUsers();
  if (users) {
    for (const user of users) {
      try {
        const response = await client.users.info({ user: user.id });

        // Extract the timezone offset from the response
        const tzOffset = response.user.tz_offset;

        // Convert the timezone offset to hours
        const tzHours = tzOffset / 3600;

        // Print the user's name and timezone offset in hours
        console.log(`${user.name}: ${tzHours} hours`);
      } catch (error) {
        // Check if the error is due to invalid credentials or user not found
        if (error.code === ErrorCode.PlatformError && error.data.error === 'user_not_found') {
          console.log(`Error: User ${user.name} not found.`);
        } else if (error.code === ErrorCode.WebAPIError && error.data.error === 'invalid_auth') {
          console.log('Error: Invalid credentials.');
        } else {
          console.log(`Error: ${error.message}`);
        }
      }
    }
  }
};

getTimezones();
