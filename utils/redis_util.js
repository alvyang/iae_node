var utils = {};
var request = require('request');
var redis = require("redis");
var client = redis.createClient();
client.on("error", function(err) {
	console.log("Error :", err);
});
client.on('connect', function() {
	console.log('Redis连接成功.');
})

/** 
 * 添加string类型的数据 
 * @param key 键 
 * @params value 值  
 * @params expire (过期时间,单位秒;可为空，为空表示不过期) 
 */
utils.set = function(key, value, expire) {
	return new Promise(function(resolve, reject) {
		client.set(key, value, function(err, result) {
			if(err) {
				console.log(err);
				reject(err);
				return;
			}
			if(!isNaN(expire) && expire > 0) {
				client.expire(key, parseInt(expire));
			}
			resolve(result);
		})
	})
};

/** 
 * 查询string类型的数据 
 * @param key 键 
 */
utils.get = function(key) {
	return new Promise(function(resolve, reject) {
		client.get(key, function(err, result) {
			if(err) {
				console.log(err);
				reject(err);
				return;
			}
			resolve(result);
		});
	})
};

module.exports = utils;