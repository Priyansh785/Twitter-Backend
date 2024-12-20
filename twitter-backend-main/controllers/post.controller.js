import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import {v2 as cloudinary} from "cloudinary"
import Notification from "../models/notification.model.js";

export const CreatePost = async(req,res)=>{
    try {
        const {text} = req.body;
        let {img} = req.body;
        const userId = req.user._id;
        const user = await User.findById(userId);
        if(!user)return res.status(404).json({error:"User not found"});

        if(!text && !img) return res.status(400).json({error:"text or img is must be required"});
        if(img){
            const uploadresponse = await cloudinary.uploader.upload(img);
            
            img = uploadresponse.secure_url;

        }
        const newPost = await Post({
            user:userId,
            text,
            img,
        });
        await newPost.save();
        return res.status(200).json({message:"Post saved successfully",newPost});
    } catch (error) {
        console.log(error);
        return res.status(500).json({error:`${error.message}`});
    }
}

export const DeletePost = async(req,res) => {
    try {
        const {id} =req.params;
        const post = await Post.findById(id);
        if(!post){
            return res.status(404).json({message:"Post not found",});
        }
        if(post.user.toString()!==req.user._id.toString()){
            return res.status(400).json({message:"UnAuthorized accesss",});
        }
        if(post.type ==="retweet"){
            const Original = await Post.findById(post.retweet.originalPost);
            Original.TotalRetweet -= 1;
            await Original.save();

        }
        if(post.img){
            const imgId = post.img.split("/").pop().split(".")[0];
			await cloudinary.uploader.destroy(imgId);
        }
        const deletePost = await Post.findByIdAndDelete(id);

        return res.status(200).json({message:"Post deleted successfully",deletePost});

    } catch (error) {
        console.log(error);
        return res.status(500).json({error:`${error.message}`});
    }
};

export const CommentonPost = async (req,res)=>{
    try {
        const {text} = req.body;
        const postId = req.params.id;
        const userId = req.user._id;
        if(!text) return res.status(400).json({message:"text field is required"});
        const post = await Post.findById(postId);
        if(!post) return res.status(404).json({message:"Post not found"});
        const comment = {user:userId,text,};
        post.comments.push(comment);
        await post.save();
        return res.status(200).json({message:"Comment successfully",post});

        
    } catch (error) {
        console.log(error);
        return res.status(500).json({error:`${error.message}`});
    }
};

export const likeUnlikePost = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id: postId } = req.params;
        const post = await Post.findById(postId);
        
        if (!post) {
            return res.status(404).json({ error: "Post not found" });
        }

        const userLikePost = post.likes.includes(userId);

        if (userLikePost) {
            await Post.updateOne({ _id: postId }, { $pull: { likes: userId } });
            await User.updateOne({ _id: userId }, { $pull: { likedPosts: postId } });
            const updateLikes = post.likes.filter(id => id.toString() !== userId.toString());

            return res.status(200).json({ message: "Unliked the Post", updateLikes });
        } else {
            post.likes.push(userId);
            await User.updateOne({ _id: userId }, { $push: { likedPosts: postId } });
            await post.save();

            const notification = new Notification({
                from: userId,
                to: post.user,
                type: 'like'
            });
            await notification.save();
            const updateLikes = post.likes;

            return res.status(200).json({ message: "Post liked successfully", updateLikes });
        }
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: error.message });
    }
};


export const AllPost = async(req, res) => {
    const {blockedUser,_id} =req.user;
    try {
        const blockedMeUsers = await User.find({ blockedUser:_id }).select('_id');
        const blockedMeUserIds = blockedMeUsers.map(user => user._id);

        // Combine both arrays of blocked user IDs
        const allBlockedUserIds = [...blockedUser, ...blockedMeUserIds];

        // const post = await Post.find({user:{$nin:allBlockedUserIds}}).sort({createdAt:-1}).populate({path:"user",select:"-password"}).populate({path:"comments.user"});
        const post = await Post.find({user:{$nin:allBlockedUserIds}})
            .populate('user', 'username fullName profileImg')
            .populate('likes', 'username fullName profileImg')
            .populate({
                path: 'comments.user',
                select: 'username fullName profileImg'
            })
            .populate({
                path: 'retweet.originalPost',
                
                populate: {
                    path: 'user',
                    select: 'username fullName profileImg'
                }
            });
        console.log(post);
        if(post.length ===0){
            return res.status(200).json([]);
        }
        return res.status(200).json({message:"fetched successfully",post});
    } catch (error) {
        console.log(error);
        return res.status(500).json({error:`${error.message}`}); 
    }
};


export const getLikedPosts = async (req, res) => {
    const userId = req.params.id;
    const {blockedUser,_id} =req.user;
    try {
        const blockedMeUsers = await User.find({ blockedUser:_id }).select('_id');
        const blockedMeUserIds = blockedMeUsers.map(user => user._id);

        // Combine both arrays of blocked user IDs
        const allBlockedUserIds = [...blockedUser, ...blockedMeUserIds];
        const user = await User.findById(userId);

        if(!user) return res.status(404).json({message:"User not found"});
        const likedPosts = await Post.find({ and:[
            {_id: { $in: user.likedPosts }},
            ,{user:{$nin:allBlockedUserIds}},
        ] })
			.populate({
				path: "user",
				select: "-password",
			})
			.populate({
				path: "comments.user",
				select: "-password",
			});

		return res.status(200).json({message:"fetched successfully",likedPosts});
    } catch (error) {
        console.log(error);
        return res.status(500).json({error:`${error.message}`});
    }
};

export const getFollowingPosts = async(req,res)=>{
    const {blockedUser,_id} = req.user;
    try {
        const userId= req.user._id;
        const user = await User.findById(userId);
        const blockedMeUsers = await User.find({ blockedUser:_id }).select('_id');
        const blockedMeUserIds = blockedMeUsers.map(user => user._id);

        // Combine both arrays of blocked user IDs
        const allBlockedUserIds = [...blockedUser, ...blockedMeUserIds];
        if(!user) return res.status(404).json({message:"User not found"});
        const following = user.following;
        const followingFeed = await Post.find({user: { $in: following, $nin: allBlockedUserIds }
        }).sort({createdAt:-1})
        .populate({
            path: "user",
            
            select: "-password",
        })
        .populate({
            path: "comments.user",
        
            select: "-password",
        });
        return res.status(200).json({message:"fetched successfully",followingFeed});
        
    } catch (error) {
        console.log(error);
        return res.status(500).json({error:`${error.message}`});
    }
}

export const getUserPosts = async (req, res) => {
	try {
        const userId = req.user._id;
		const { id } = req.params;
        const {blockedUser ,_id} = req.user;

		const user = await User.findById(id);
        const isblocked = user.blockedUser.includes(userId);
        const blockedMeUsers = await User.find({ blockedUser:_id }).select('_id');
        const blockedMeUserIds = blockedMeUsers.map(user => user._id);

        // Combine both arrays of blocked user IDs
        const allBlockedUserIds = [...blockedUser, ...blockedMeUserIds];
        if (isblocked) {
            return res.status(403).json({message:"you Blocked user"});

        }
		if (!user) return res.status(404).json({ error: "User not found" });

		const post = await Post.find({ 
            $and: [
              { user: user._id },
              { user: { $nin: allBlockedUserIds } }
            ]
          })
			.sort({ createdAt: -1 })
			.populate({
				path: "user",
                match:{_id:{$nin:allBlockedUserIds}},
				select: "-password",
			})
			.populate({ 
				path: "comments.user",
                match:{ _id: { $nin: allBlockedUserIds } },
				select: "-password",
			});

		res.status(200).json({message:"Successfully",post});
	} catch (error) {
		console.log("Error in getUserPosts controller: ", error);
		res.status(500).json({ error: "Internal server error" });
	}
};


export const retweet = async (req, res) => {
    try {
        const userId = req.user._id;
        const { id: postId } = req.params;
        const originalPost = await Post.findById(postId);

        if (!originalPost) {
            return res.status(404).json({ error: "Post not found" });
        }

        if (originalPost.type === 'retweet') {
            return res.status(400).json({ error: 'Cannot retweet a retweet' });
        }

        const existingRetweet = await Post.findOne({ type: 'retweet', user: userId, 'retweet.originalPost': postId });

        if (existingRetweet) {
            await Post.deleteOne({ _id: existingRetweet._id });
            originalPost.TotalRetweet -= 1;
            await originalPost.save();
            return res.status(200).json({ message: "Retweet removed successfully" });
        } else {
            const newRetweet = new Post({
                user: userId,
                type: 'retweet',
                retweet: {
                    originalPost: originalPost._id,
                    user: originalPost.user
                }
            });
            originalPost.TotalRetweet += 1;
            await originalPost.save();
            await newRetweet.save();

            const notification = new Notification({
                from: userId,
                to: originalPost.user,
                type: 'retweet'
            });
            await notification.save();

            return res.status(200).json({ message: "Post retweeted successfully", retweetId: newRetweet._id });
        }
    } catch (error) {
        console.log("Error in retweet controller: ", error);
        res.status(500).json({ error: "Internal server error" });
    }
}

