
const Pool = require('../lib/Pool');

const device = 'boom1';
const pool = new Pool('localhost', 7878, 'Pool test', 3);

const promises = [];

function readParameter(param) {
    let nc;
    return pool.acquire()
        .then((client) => {
            nc = client;
            return nc.read(device, [param]);
        })
        .then((result) => {
            console.log(`Parameter ${param} is ${result[param]}`);
        })
        .then(() => pool.release(nc))
        .catch((error) => {
            pool.release(nc);
            console.error('Error!', error);
        });
}

for (let n = 0; n < 6; n++) {
    promises.push(readParameter(`${n}`));
}

Promise.all(promises)
    .then(() => { console.log('All done!'); pool.disconnect(); });

