import express from 'express'
import bodyParser from 'body-parser'
import cors from 'cors'
import mongoose from 'mongoose'

// Defines the port the app will run on. Defaults to 8080, but can be 
// overridden when starting the server. For example:
//
//   PORT=9000 npm start
const port = process.env.PORT || 8080
const app = express()

// error messages
const ERR_CANNOT_SAVE_TO_DATABASE = 'Could not save thought to the Database';
const ERR_CANNOT_FIND_VIDEO_BY_ID = 'Could not find video by id provided';


const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/yogaStudio"
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
mongoose.Promise = Promise

const userSchema = new mongoose.Schema({

  user_name: {
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
    isAdmin:
{
  type:Boolean,
  default: false
},
//selectedVideos: {
  //[]
//},
//Object ID which id liked which video id 
//aggreagate mongo
//carusel, most favourited 
});

//week 18th and date 16th

const videoSchema = new mongoose.Schema({
  video_name: { 
    type: String,
    unique: true,
    required: true,
  },
  description: {
    type: String,
  },
  video_url: {
    type: String,
  },
  category: {
    type: String,
    required:true
  },
  duration: {
    type:Number
  },
  rating: {
    type:Number
  },
  createdAt:
  {
 type: Date,
    default: Date.now
  },
  updatedAt:{
 type: Date,
    default: Date.now
},
likes:{
    type: Number,
    default: 0
}
//{ timestamps: true }
});


// link: {
//     type: String,
//     required: true
//   }
// }, { timestamps: true })
//link  users to collection and then ref in user

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(bodyParser.json())

const User = mongoose.model("User", userSchema);
const Video = mongoose.model("Video", videoSchema);

// Start defining your routes here
app.get('/', (req, res) => {
  res.send('Hello world')
})

// HERE ARE THE ENDPOINTS TO WORK WITH VIDEO COLLECTION

//get the collection of videos
app.get('/videos', async (req, res) => {
  const videos = await Video.find().sort({createdAt:'desc'}).limit(8).exec();
  res.json(videos);
});

// video liked
//i need to limit likes on and off for ine particulat user to be able to filter videos by total amount of likes 
app.post('/thoughts/:id/liked', async(req,res)=>{
  try{
    const { id } = req.params;
    await Video.updateOne( {_id: id}, { $inc: {likes: 1} });
    res.status(200).json({success: true});
  } catch(err) {
    res.status(400).json({message: ERR_CANNOT_FIND_VIDEO_BY_ID, errors:err.errors});
  }
});


//post a video, function available only for admins 
app.post('/thoughts', async (req, res) => {
  //Try catch
  try {
    //Success case
    //retrive the information sent by the client to our API endpoint
    const { video_name } = req.body
    const { video_url } = req.body
    const { description } = req.body
    const { duration } = req.body
    const { category } = req.body
    const video = new Video({ video_name, video_url, description, duration, category });
    const savedVideo = await video.save();
    res.status(200).json(savedVideo) 
  } catch(err) {
    //bad request sending the status to the server and the message
    res.status(400).json({message: ERR_CANNOT_SAVE_TO_DATABASE, errors:err.errors});
  }
});
//delete a video function is available only for admin
app.delete('/videos/:id', async(req,res)=>{
  try{
    //try to delete and send a successful response
    const{ id } = req.params;
    await Video.deleteOne({ _id: id });
    res.status(200).json({ success: true });
  } catch(error) {
    console.log(error)
    //inform the client about the deletion failure
    res.status(400).json({ success:false });
  }
});


// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
