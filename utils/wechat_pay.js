var request = require("request");
var redis = require("../utils/redis_util.js");

var wechat = require("./wechat_util.js").getWechat();

//统一下单接口地址
var unifiedorder = "https://api.mch.weixin.qq.com/pay/unifiedorder";

//Promise化request  
var requestUrl = function(opts){
    opts = opts || {};  
    return new Promise(function(resolve, reject){
        request(opts,function(error, response, body){  
            if (error) {
                return reject(error);  
            }  
            resolve(body);  
        })  
    })  
}; 

/*
 * 解析XML
 * @param data:要转换的对象模型 ，xml：要解析的xml数据
 * @return 解析后的对象
 */
function getXMLNodeValue(node_name,xml){
    var tmp = xml.split("<"+node_name+">");
    var _tmp = tmp[1].split("</"+node_name+">");
    return _tmp[0];
}

/* 
 * @params 统一下单的请求参数
 * @return 微信统一下单，请求
 */
exports.unifiedorder = function(order){
	var weOrder={
		appId:wechat.appId,
		mch_id:wechat.mch_id,//商户号
		nonce_str:"1",//随机字符串
		body:"晋味大观-食品",//商品描述
		attach:"2",//附加数据  0
		out_trade_no:order.sn,//商户订单号
		total_fee:order.fee*100,//标价金额 单位为分
		spbill_create_ip:"3",//终端IP
		notify_url:"http://www.jin-wei.shop/inter/wechat_pay/payNotifyUrl",//通知地址
		trade_type:"JSAPI",//交易类型
		openid:"sdf",
	}
	var formData  = "<xml>";
	    formData  += "<appid>"+weOrder.appId+"</appid>";  //appid
	    formData  += "<attach>"+weOrder.attach+"</attach>"; //附加数据
	    formData  += "<body>"+weOrder.body+"</body>";
	    formData  += "<mch_id>"+weOrder.mch_id+"</mch_id>";  //商户号
	    formData  += "<nonce_str>"+weOrder.nonce_str+"</nonce_str>"; //随机字符串，不长于32位。
	    formData  += "<notify_url>"+weOrder.notify_url+"</notify_url>";
	    formData  += "<openid>"+weOrder.openid+"</openid>";
	    formData  += "<out_trade_no>"+weOrder.out_trade_no+"</out_trade_no>";
	    formData  += "<spbill_create_ip>"+weOrder.spbill_create_ip+"</spbill_create_ip>";
	    formData  += "<total_fee>"+weOrder.total_fee+"</total_fee>";
	    formData  += "<trade_type>"+weOrder.trade_type+"</trade_type>";
	    formData  += "<sign>"+paysignjsapi(weOrder)+"</sign>";
	    formData  += "</xml>";
	    
	var options = {
		method: 'POST',
		url: unifiedorder,
		body: formData
  	};
  	return requestUrl(options);
}


exports.jsapipay = function (req, res) {
    var bookingNo = req.query.bookingNo;
    var appid = _appid;
    var attach = _attach;
    var mch_id = _mch_id;
    var nonce_str = _nonce_str;
    var total_fee = _total_fee;
    var notify_url = _notify_url;
    var openid = _openid;
    var body = _body;
    var timeStamp = _timeStamp; 
    var url = "https://api.mch.weixin.qq.com/pay/unifiedorder";
    var formData  = "<xml>";
    formData  += "<appid>"+appid+"</appid>";  //appid
    formData  += "<attach>"+attach+"</attach>"; //附加数据
    formData  += "<body>"+body+"</body>";
    formData  += "<mch_id>"+mch_id+"</mch_id>";  //商户号
    formData  += "<nonce_str>"+nonce_str+"</nonce_str>"; //随机字符串，不长于32位。
    formData  += "<notify_url>"+notify_url+"</notify_url>";
    formData  += "<openid>"+openid+"</openid>";
    formData  += "<out_trade_no>"+bookingNo+"</out_trade_no>";
    formData  += "<spbill_create_ip></spbill_create_ip>";
    formData  += "<total_fee>"+total_fee+"</total_fee>";
    formData  += "<trade_type>JSAPI</trade_type>";
    formData  += "<sign>"+paysignjsapi(appid,attach,body,mch_id,nonce_str,notify_url,openid,bookingNo,'',total_fee,'JSAPI')+"</sign>";
    formData  += "</xml>";
    request({url:url,method:'POST',body: formData},function(err,response,body){
        if(!err && response.statusCode == 200){
            console.log(body);
            var prepay_id = getXMLNodeValue('prepay_id',body.toString("utf-8"));
            var tmp = prepay_id.split('[');
            var tmp1 = tmp[2].split(']');
            //签名
            var _paySignjs = paysignjs(appid,nonce_str,'prepay_id='+tmp1[0],'MD5',timeStamp);
            res.render('jsapipay',{prepay_id:tmp1[0],_paySignjs:_paySignjs});
            //res.render('jsapipay',{rows:body});
            //res.redirect(tmp3[0]);
        }
    });
}