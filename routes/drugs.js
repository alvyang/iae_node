var express = require("express");
var router = express.Router();

//验证产品编码是否存在
router.post("/exitsCode",function(req,res){
  var drugs = DB.get("Drugs");
  req.body.group_id = req.session.user[0].group_id;
  req.body.delete_flag = '0';
  drugs.where(req.body,function(err,result){
    res.json({"code":"000000",message:result});
  });
});

function deleteParams(params){
  for (var pro in params) {
    if(!params[pro]){
      delete params[pro];
    }
  }
}
//新增组
router.post("/saveDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf("59") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  req.body.group_id = req.session.user[0].group_id;
  delete req.body.product_id;
  deleteParams(req.body);
  drugs.insertIncrement(req.body,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
//编辑菜单
router.post("/editDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf("57") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  delete req.body.contacts_name;
  if(!req.body.contacts_id){
    delete req.body.contacts_id;
  }
  // deleteParams(req.body);
  var drugs = DB.get("Drugs");
  drugs.update(req.body,'product_id',function(err,result){
    console.log(err);
    res.json({"code":"000000",message:null});
  });
});
//删除菜单
router.post("/deleteDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf("58") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  req.body.delete_flag = 1;
  drugs.update(req.body,'product_id',function(err,result){
    res.json({"code":"000000",message:null});
  });
});
//获取药品列表
router.post("/getDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf("56") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  var sql = "select d.*,c.contacts_name from drugs d left join contacts c on d.contacts_id = c.contacts_id where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.data.productCommonName){
    sql += " and d.product_common_name like '%"+req.body.data.productCommonName+"%'";
  }
  if(req.body.data.contactId){
    sql += " and d.contacts_id = "+req.body.data.contactId+""
  }
  if(req.body.data.product_medical_type){
    sql += " and d.product_medical_type = '"+req.body.data.product_medical_type+"'"
  }
  if(req.body.data.product_type){
    var type = req.body.data.product_type;
    var t = "";
    for(var i = 0 ; i < type.length ; i++){
      t+="'"+type[i]+"',"
    }
    t = t.substring(0,t.length-1);
    sql += " and d.product_type in ("+t+")"
  }
  drugs.countBySql(sql,function(err,result){
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by d.product_id desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    drugs.executeSql(sql,function(err,result){
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
//获取生产企业，分组查询
router.post("/getProductMakesmakers",function(req,res){
  var drugs = DB.get("Drugs");
  var sql = "select d.product_makesmakers,d.product_supplier from drugs d where d.group_id = '"+req.session.user[0].group_id+"' group by d.product_makesmakers,d.product_supplier";
  drugs.executeSql(sql,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
