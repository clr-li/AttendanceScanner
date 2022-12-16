const { exec } = require("child_process");

exec("firebase deploy --token " + process.env.TOKEN, (error, stdout, stderr) => {
    if (error) {
        console.log(error.message);
        return;
    }
    if (stderr) {
        console.log(stderr);
        return;
    }
    console.log(`Output: ${stdout}`);
});