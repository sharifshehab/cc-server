require('dotenv').config();

const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 5000;
// middleware
app.use(cors(
    {
        origin: ['http://localhost:5173'],
        credentials: true
    }
));
app.use(express.json());
app.use(cookieParser());



const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rdxg6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

const verifyingToken = (req, res, next) => {
    const token = req.cookies?.token;
    console.log('verifyingToken', req.cookies);

    if (!token) {
        return res.status(401).send({ message: 'Not authorized' });
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized' });
        }
        req.user = decoded;
        next();
    });
};


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });

        const craftCollection = client.db("clayCornerDB").collection("crafts");
        /* DB-name */         /* Table-name */


        /* JWT */
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.cookie('token', token, {
                httpOnly: true,
                secure: true,
                sameSite: 'none'
            })
                .send({ success: true });
        });

        app.post('/logout', async (req, res) => {
            const user = req.body;
            res.clearCookie('token', { maxAge: 0 }).send({ success: true });
        });

        /* getting items from the DB */
        app.get('/crafts', async (req, res, next) => {
            
            // If an email query parameter is present, apply token verification
            if (req.query?.email) {
                return verifyingToken(req, res, (err) => {
                    if (err) {
                        // If there's an error in verifying the token, return the error response
                        return res.status(401).send({ message: 'Unauthorized' });
                    }
                    // After verifying the token, check if the email matches
                    if (req.query.email !== req.user.email) {
                        return res.status(403).send({ message: 'Forbidden access' });
                    }
                    // Continue to the next handler if verification and checks pass
                    next();
                });
            }

            next();  // If no email, continue without verifyingToken
        }, async (req, res) => {

            // Pagination: Default to 0 for page and 10 for size if not provided
            const page = parseInt(req.query.page) || 0;
            const size = parseInt(req.query.size) || 10;

            // Fetch only category names if the query asks for categories
            if (req.query?.category === 'category') {
                const items = await craftCollection.find().project({ category: 1 }).toArray(); // Fetch only category field
                const categories = [...new Set(items.map(item => item.category))]; // Get unique category names
                return res.send(categories);
            }

            // Initialize the query object
            let query = {};

            // Fetch only current user uploaded item
            if (req.query?.email) {
                query.email = req.query.email;
            }

            // Search by 'name' using regex (case-insensitive)
            const searchValue = req.query.search;
            if (typeof searchValue === 'string' && searchValue.trim() !== '') {
                query.name = { $regex: searchValue, $options: 'i' };
            }

            // Create the query for fetching the items, applying pagination
            let api = craftCollection.find(query).skip(page * size).limit(size).sort({ _id: -1 });

            // Fetch only 4 items ( limit is provided = 4 )
            const limit = parseInt(req.query.limit); // Get the 'post limit' from the query parameter              
            if (limit && !req.query.page) {
                // Apply the limit only if pagination is not requested (to avoid conflicts)
                api = api.limit(limit);
            }

            const result = await api.toArray();
            res.send(result);
        });

        
        /* Pagination */
        app.get('/craftsCount', async (req, res) => {
            const count = await craftCollection.estimatedDocumentCount();
            res.send({ count });
        })


        /* add items to DB */
        app.post('/crafts', async (req, res) => {
            const newItem = req.body;
            const result = await craftCollection.insertOne(newItem);
            res.send(result);
        });

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Hello World');
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`)
});

/* 

*/