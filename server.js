import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import mongoose from "mongoose";
import endpoints from "express-list-endpoints";
import crypto from "crypto";
import bcrypt from "bcrypt";
//import { StringDecoder } from "string_decoder";
// Defines the port the app will run on.

const port = process.env.PORT || 8080;
const app = express();

// list endpoints in the '/' route
// const listEndpoints = require("express-list-endpoints");

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
    minlength: 4,
    maxlength: 20,
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
  //reference to the videos, saving them in the array
  selectedVideos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Video" }],
});

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

    likes: {
      type: Number,
      default: 0,
      min: 0,
      max: 1,
    },
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
  res.send(listEndpoints(app));
});

// HERE ARE THE ENDPOINTS FOR SIGN IN / SIGN UP

//this middleware is for user authentification
const authenticateUser = async (req, res, next) => {
  try {
    const accessToken = req.header("Authorization");
    const user = await User.findOne({ accessToken });
    if (!user) {
      throw "User not found";
    }
    req.user = user;
    next();
  } catch (err) {
    const errorMessage = "User not found. Please try logging in again";
    res.status(401).json({ error: errorMessage });
  }
};

// Sign-up

app.post("/users", async (req, res) => {
  try {
    const { userName, email, password } = req.body;
    console.log("!!!", userName, email, password);
    const SALT = bcrypt.genSaltSync(10);
    const user = await new User({
      userName,
      email,
      password: bcrypt.hashSync(password, SALT),
    }).save();
    res.status(200).json({
      message: "User created!",
      userId: user._id,
      accessToken: user.accessToken,
      userName: user.userName,
      email: user.email,
      password: user.password,
    });
  } catch (err) {
    console.log("!!!", err, "!!!");
    res.status(400).json({ message: "Could not create user", errors: err });
  }
});

app.post("/sessions", async (req, res) => {
  try {
    const { email, password } = req.body;
    const accessTokenUpdate = crypto.randomBytes(128).toString("hex");
    console.log("!!!", email, password);
    const user = await User.findOne({ email });
    if (user && bcrypt.compareSync(password, user.password)) {
      const updatedUser = await User.findOneAndUpdate(
        { email: email },
        { accessToken: accessTokenUpdate },
        { new: true, useFindAndModify: false }
      );
      res.status(200).json({
        userId: updatedUser._id,
        accessToken: updatedUser.accessToken,
        userName: updatedUser.userName,
      });
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
  const videos = await Video.find()
    .sort({ createdAt: "desc" })
    .limit(20)
    .exec();
  res.json(videos);
});

//Route to find one specific video by id
app.get("/videos/:id", async (req, res) => {
  const videoById = await Video.findOne({ _id: req.params.id });
  if (videoById) {
    res.json(videoById);
  } else {
    res.status(404).json({ error: "Video not found" });
  }
});

//filter videos by length, endpoint that can be developed in the future
//at the moment frontend is responsible for filtering

//filter videos - 15, 20, 30
app.get("/videos/length/30", async (req, res) => {
  const videosByLength = await Video.find({ length: 30 });
  if (videosByLength) {
    res.json(videosByLength);
  } else {
    res.status(404).json({ error: "No such video found" });
  }
});
app.get("/videos/length/15", async (req, res) => {
  const videosByLength = await Video.find({ length: 15 });
  if (videosByLength) {
    res.json(videosByLength);
  } else {
    res.status(404).json({ error: "No such video found" });
  }
});
app.get("/videos/length/20", async (req, res) => {
  const videosByLength = await Video.find({ length: 20 });
  if (videosByLength) {
    res.json(videosByLength);
  } else {
    res.status(404).json({ error: "No such video found" });
  }
});

// PUT: endpoint to add favoritevideo for a logged-in user:
// UPDATES the user and adds the favorite video to the favorite videos-array for that user.

//<----------SHOW FAVORITE VIDEOS, ADD TO FAVORITE AND DELETE FROM FAVORITE---------->
//--ADD--
app.put("/users/:userId/favorites/:videoId", authenticateUser);
app.put("/users/:userId/favorites/:videoId", async (req, res) => {
  const { userId, videoId } = req.params;
  try {
    const selectedVideo = await Video.findById(videoId); // Find the video the user wants to add.
    console.log("selectedVideo", selectedVideo);
    await User.updateOne(
      { _id: userId },
      { $push: { selectedVideos: selectedVideo } } //push the selected video into the favorite videos array
    );
    res.status(200).json(selectedVideo);
  } catch (err) {
    res.status(404).json({
      message: "Could not add video.",
      errors: { message: err.message, error: err },
    });
  }
});

//--DELETE--
app.delete("/users/:userId/favorites/:videoId", authenticateUser);
app.delete("/users/:userId/favorites/:videoId", async (req, res) => {
  const { userId, videoId } = req.params;
  try {
    const selectedVideo = await Video.findById(videoId); // Find the video the user wants to delete.
    console.log("selectedVideo", selectedVideo);
    await User.updateOne(
      { _id: userId },
      { $pull: { selectedVideos: { $in: [selectedVideo] } } } //delete the selected video from the favorite videos array
    );
    res.status(200).json(selectedVideo);
  } catch (err) {
    console.log(err);
    res.status(404).json({
      message: "Could not remove video.",
      errors: { message: err.message, error: err },
    });
  }
});
//--SHOW FAVORITE VIDEOS--

app.get("/users/:userId/favorites", authenticateUser);
app.get("/users/:userId/favorites", async (req, res) => {
  try {
    const userId = req.params.userId;
    if (userId != req.user._id) {
      throw "Access denied";
    }
    const favoritesArray = await req.user.selectedVideos; //array of added videos (video-id:s)
    const getCurrentFavoriteVideos = await Video.find({
      _id: favoritesArray,
    }); // gives the  video-object in user favorites
    res.status(200).json(getCurrentFavoriteVideos);
  } catch (err) {
    res.status(403).json({
      message: "Could not get favorite videos. User must be logged in.",
      errors: { message: err.message, error: err },
    });
  }
});

//likes are not used in the project at the moment, but can be used in the future
app.post("/videos/:id/like", async (req, res) => {
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
      videoUrl,
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
//delete a video function is available only for admin  {WORKING}
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
