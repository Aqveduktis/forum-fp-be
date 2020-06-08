import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcrypt-nodejs';
import fetch from 'node-fetch';

require('express-async-errors');
import { User, Message } from './model';

const mongoUrl = process.env.MONGO_URL || 'mongodb://localhost/forum';
mongoose.connect(mongoUrl, { useCreateIndex: true, useNewUrlParser: true, useUnifiedTopology: true });
//mongoose.set('useCreateIndex', true);
mongoose.Promise = Promise;

// Defines the port the app will run on. Defaults to 8080, but can be
// overridden when starting the server. For example:
//
//   PORT=9000 npm start
const port = process.env.PORT || 8080;
const app = express();

// Add middlewares to enable cors and json body parsing
app.use(cors());
app.use(bodyParser.json());

// if (process.env.RESET_DB){
//   const seedDatabase = async () => {
//     await ArtistDetail.deleteMany()

//     artistData.forEach((artist) => {
// 			new ArtistDetail(artist).save()
// 		})
//   }
//   seedDatabase()
// }

// "id": 28,
//             "slug": "red-dead-redemption-2",
//             "name": "Red Dead Redemption 2",
//             "released": "2018-10-26",
//             "tba": false,
//             "background_image": "https://media.rawg.io/media/games/511/5118aff5091cb3efec399c808f8c598f.jpg",
//             "rating": 4.56,
//             "rating_top": 5,
//"ratings_count": 2447,

// "short_screenshots": [
//   {
//       "id": -1,
//       "image": "https://media.rawg.io/media/games/511/5118aff5091cb3efec399c808f8c598f.jpg"
//   },
//   {
//       "id": 778173,
//       "image": "https://media.rawg.io/media/screenshots/7b8/7b8895a23e8ca0dbd9e1ba24696579d9.jpg"
//   },
//   {
//       "id": 778174,
//       "image": "https://media.rawg.io/media/screenshots/b8c/b8cee381079d58b981594ede46a3d6ca.jpg"
//   },
//   {
//       "id": 778175,
//       "image": "https://media.rawg.io/media/screenshots/fd6/fd6e41d4c30c098158568aef32dfed35.jpg"
//   },
//   {
//       "id": 778176,
//       "image": "https://media.rawg.io/media/screenshots/2ed/2ed3b2791b3bbed6b98bf362694aeb73.jpg"
//   },
//   {
//       "id": 778177,
//       "image": "https://media.rawg.io/media/screenshots/857/8573b9f4f06a0c112d6e39cdf3544881.jpg"
//   },
//   {
//       "id": 778178,
//       "image": "https://media.rawg.io/media/screenshots/985/985e3e1f1d1af1ab0797d43a95d472cc.jpg"
//   }

// "genres": [
//   {
//       "id": 4,
//       "name": "Action",
//       "slug": "action",
//       "games_count": 87823,
//       "image_background": "https://media.rawg.io/media/games/b7b/b7b8381707152afc7d91f5d95de70e39.jpg"
//   },
//   {
//       "id": 2,
//       "name": "Shooter",
//       "slug": "shooter",
//       "games_count": 25937,
//       "image_background": "https://media.rawg.io/media/games/198/1988a337305e008b41d7f536ce9b73f6.jpg"
//   }
// ],

const authenticateUser = async (req, res, next) => {
	try {
		const user = await User.findOne({
			accessToken: req.header('Authorization')
		});
		console.log(req.header('Authorization'));
		if (user) {
			req.user = user;
			next();
		} else {
			res.status(401).json({ loggedOut: true, message: 'Please try logging in again' });
		}
	} catch (err) {
		res.status(403).json({ message: 'access token missing or wrong', errors: err.errors });
	}
};
// Start defining your routes here
app.get('/', (req, res) => {
	res.send('Hello world');
});
app.get('/users', async (req, res) => {
	const users = await User.find();
	res.json(users);
});

app.post('/users', async (req, res) => {
	try {
		const { name, password } = req.body;
		if (password) {
			const user = new User({ name, password: bcrypt.hashSync(password) });
			const saved = await user.save();
			res.status(201).json(saved);
		} else {
			throw 'you have to have a password';
		}
	} catch (err) {
		res.status(400).json({ message: 'Could not save user 1', errors: err });
	}
});

app.get('/users/:id', authenticateUser);
app.get('/users/:id', (req, res) => {
	try {
		res.status(201).json({ name: req.user.name });
	} catch (err) {
		res.status(400).json({ message: 'could not save user 2', errors: err.errors });
	}
});
app.delete('/users/:id', async (req, res) => {
	const { id } = req.params;
	try {
		await User.findOneAndDelete({ _id: id });
		res.json({ message: `thought with id:${id} was delted` });
	} catch (err) {
		res.status(400).json({ message: 'thought could not be deleted', error: err });
	}
});

app.get('/users/:id/messages', authenticateUser);
app.get('/users/:id/messages', async (req, res) => {
	try {
		const user = await User.findById(req.user._id).exec();
		const messages = await Message.find({ user: mongoose.Types.ObjectId(user.id) });
		if (messages.length) {
			res.status(200).json(messages);
		} else {
			throw 'Sorry no messages';
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});
app.post('/users/:id/messages', authenticateUser);
app.post('/users/:id/messages', async (req, res) => {
	try {
		const { message, game } = req.body;
		const user = await User.findById(req.user._id).exec();
		const newMessage = await new Message({ message, game, user }).save();
		res.status(201).json({ message: newMessage.message, user: newMessage.user.name });
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

app.post('/sessions', async (req, res) => {
	const user = await User.findOne({ name: req.body.name });

	if (user && bcrypt.compareSync(req.body.password, user.password)) {
		res.json({ userId: user._id, accessToken: user.accessToken });
	} else {
		res.json({ notFound: true });
	}
});
app.get('/messages', async (req, res) => {
	try {
		const messages = await Message.find().populate('user', 'name');
		if (messages.length) {
			res.status(200).json(messages);
		} else {
			throw 'you have no messages';
		}
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

app.get('/games', async (req, res) => {
	const myUrl = 'https://api.rawg.io/api/games?ordering=-rating0';
	try {
		const result = await fetch(myUrl);
		const json = await result.json();
		res.status(200).json(json);
		//const github = await oIfoundData()const ooiResponseData = await github.json()console.log(ooiResponseData)
	} catch (err) {
		res.status(400).json({ error: err });
	}
});

// Start the server
app.listen(port, () => {
	console.log(`Server running on http://localhost:${port}`);
});
