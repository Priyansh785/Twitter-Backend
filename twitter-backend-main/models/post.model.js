import mongoose, { Schema } from "mongoose";


const PostSchema = new Schema({
    user:{
        type:mongoose.Schema.Types.ObjectId,

        required:true,
        ref:"User"
    },
    type:{
        type: String,
        enum: ['post', 'retweet'],
        required: true,
        default: 'post' 
    },
    text:{
        type:String,
    },
    img:{
        type:String,
    },
    likes:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:"User",
        default:[]
    }],
    comments:[{
        text:{
            type:String,
            required:true,
        },
        user:{
            type:mongoose.Schema.Types.ObjectId,
        required:true,
        ref:"User"
        }
    }],
    retweet: {
        originalPost: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Post'
        },
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    TotalRetweet:{
        type:Number,
        default:0,
    }



},{timestamps: true});



const Post = mongoose.model("Post",PostSchema);
export default Post;