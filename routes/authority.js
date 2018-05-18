var express = require("express");
var router = express.Router();

//新增菜单
router.post("/saveAuthoritys",function(req,res){
  var authority = DB.get("Authority");
	delete req.body.label;
  authority.insertIncrement(req.body,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
//编辑菜单
router.post("/editAuthoritys",function(req,res){
  var authority = DB.get("Authority");
	delete req.body.label;
  delete req.body.id;
  authority.update(req.body,'authority_id',function(err,result){
    res.json({"code":"000000",message:null});
  });
});
//线性数据转化为树。
function toTree(data, parent_id) {
    var tree = [];
    var temp;
    for (var i = 0; i < data.length; i++) {
        if (data[i].authority_parent_id == parent_id) {
            var obj = data[i];
            temp = toTree(data, data[i].authority_id);
            if (temp.length > 0) {
             obj.children = temp;
           }else{
             obj.children = [];
           }
            tree.push(obj);
        }
    }
    return tree;
}
//获得全部菜单
router.post("/getAuthoritys",function(req,res){
  var authority = DB.get("Authority");
  authority.where({delete_flag:0},{authority_code:"asc"},function(err,result){
    if(err){
      res.json({"code":"100000",message:"查询菜单出错"});
    }else{
      for(var i = 0 ; i < result.length ; i++){
        result[i].label = result[i].authority_name;
        result[i].id = result[i].authority_id;
      }
      res.json({"code":"000000",message:toTree(result,null)});
    }
  });
});
//获得对外开放的菜单
router.post("/getOpenAuthoritys",function(req,res){
  var authority = DB.get("Authority");
  authority.where({delete_flag:0,authority_open:1},{authority_code:"asc"},function(err,result){
    if(err){
      res.json({"code":"100000",message:"查询菜单出错"});
    }else{
      for(var i = 0 ; i < result.length ; i++){
        result[i].label = result[i].authority_name;
        result[i].id = result[i].authority_id;
      }
      res.json({"code":"000000",message:toTree(result,null)});
    }
  });
});

module.exports = router;