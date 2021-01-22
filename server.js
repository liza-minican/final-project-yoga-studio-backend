import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mongoose from "mongoose";
import endpoints from "express-list-endpoints";
import crypto from "crypto";
import bcrypt from "bcrypt";
// Defines the port the app will run on.

const port = process.env.PORT || 8080;
const app = express();

// error messages
const ERR_CANNOT_SAVE_TO_DATABASE = "Could not save video to the Database";
const ERR_CANNOT_FIND_VIDEO_BY_ID = "Could not find video by id provided";

const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/yogaStudio";
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.Promise = Promise;

//user schema for sign in and sugn up with relation to video schema to store user's favourite videos
const userSchema = new mongoose.Schema({
  userName: {
    type: String,
    minlength: 5,
    maxlength: 20,
    unique: true,
    required: true,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
    minlength: 6,
    required: true,
  },
  accessToken: {
    type: String,
    default: () => crypto.randomBytes(128).toString("hex"),
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  //reference to the videos, storing them in the array
  selectedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],

  // selectedVideos: {
  //   type: Array,
  // },
});

//week 18th and date 16th watch

const videoSchema = new mongoose.Schema(
  {
    videoName: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    videoUrl: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ["Beginner", "Intermediate", "Advanced"],
    },
    length: {
      type: Number,
      required: true,
    },
    //RATING AND LIKES CAN BE ADDED LATER
    // rating: {
    //   type: Number,
    //   enum: [1,2,3,4,5]
    // },

    // likes: {
    //   type: Number,
    //   default: 0,
    // },

    //reference to the user
    //   user: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "User",
    //   },
  },
  { timestamps: true }
);

// Add middlewares to enable cors and json body parsing
app.use(cors());
app.use(bodyParser.json());

const User = mongoose.model("User", userSchema);
const Video = mongoose.model("Video", videoSchema);

//Provide error of server

app.use((req, res, next) => {
  if (mongoose.connection.readyState === 1) {
    next();
  } else {
    res.status(503).json({ error: "Service unavailable at the moment" });
  }
});

// Start defining routes here
app.get("/", (req, res) => {
  res.send("Hello world");
});

// HERE ARE THE ENDPOINTS FOR SIGN IN / SIGN UP

// const authenticateUser = async (req, res, next) => {
//   try {
//     const accessToken = req.header("Authorization");
//     const user = await User.findOne({ accessToken });
//     if (!user) {
//       throw "User not found";
//     }
//     req.user = user;
//     next();
//   } catch (err) {
//     const errorMessage = "Please try logging in again";
//     res.status(401).json({ error: errorMessage });
//   }
// };

// Sign-up

app.post("/users", async (req, res) => {
  try {
    const { userName, password } = req.body;
    console.log("!!!", userName, password);
    const user = await new User({
      userName,
      email: "liza@mail.ru",
      password: bcrypt.hashSync(password),
    }).save();
    res.status(200).json({ userId: user._id, accessToken: user.accessToken });
  } catch (err) {
    res.status(400).json({ message: "Could not create user", errors: err });
  }
});

// Login
app.post("/sessions", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (user && bcrypt.compareSync(password, user.password)) {
      res.status(200).json({ userId: user._id, accessToken: user.accessToken });
    } else {
      throw "User not found";
    }
  } catch (err) {
    res.status(404).json({ error: "User not found" });
  }
});
// HERE ARE THE ENDPOINTS TO WORK WITH VIDEO COLLECTION

//get the collection of all videos available to everyone
app.get("/videos", async (req, res) => {
  const videos = await Video.find().sort({ createdAt: "desc" }).limit(8).exec();
  res.json(videos);
});

//top 10 videos

//Route to find one specific video by id
app.get("/videos/:id", async (req, res) => {
  const videoById = await Video.findOne({ id: req.params.id });
  if (videoById) {
    res.json(videoById);
  } else {
    res.status(404).json({ error: "Video not found" });
  }
});

//filter videos by length

//filter short videos - 15, 30, 60
app.get("/video/length", async (req, res) => {
  const shortVideos = await Video.find({ length: { $lt: 15 } });
  if (shortVideos.length > 0) {
    res.json(shortVideos);
  } else {
    res.status(404).json({ error: "No such video found" });
  }
});

//video by level

//videos available when signed in
//your favourite videos

// video liked
//i need to limit likes on and off for ine particulat user to be able to filter videos by total amount of likes
app.post("/videos/:id/liked", async (req, res) => {
  try {
    const { id } = req.params;
    await Video.updateOne({ _id: id }, { $inc: { likes: 1 } });
    res.status(200).json({ success: true });
  } catch (err) {
    res
      .status(400)
      .json({ message: ERR_CANNOT_FIND_VIDEO_BY_ID, errors: err.errors });
  }
});

//post a video, function available only for admins
app.post("/videos", async (req, res) => {
  //Try catch
  try {
    //Success case
    //retrive the information sent by the client to our API endpoint
    const { videoName, videoUrl, description, length, category } = req.body;
    const video = new Video({
      videoName,
      videUrl,
      description,
      length,
      category,
    });
    const savedVideo = await video.save();
    res.status(200).json(savedVideo);
  } catch (err) {
    //bad request sending the status to the server and the message
    res
      .status(400)
      .json({ message: ERR_CANNOT_SAVE_TO_DATABASE, errors: err.errors });
  }
});
//delete a video function is available only for admin
app.delete("/videos/:id", async (req, res) => {
  try {
    //try to delete and send a successful response
    const { id } = req.params;
    await Video.deleteOne({ _id: id });
    res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    //inform the client about the deletion failure
    res.status(400).json({ success: false });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
