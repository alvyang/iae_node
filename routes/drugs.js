var express = require("express");
var pinyin = require("node-pinyin");
var logger = require('../utils/logger');
var util= require('../utils/global_util.js');
var router = express.Router();

//验证产品编码是否存在
router.post("/getFirstLetter",function(req,res){
  res.json({"code":"000000",message:util.getFirstLetter(req.body.name)});
});
//验证产品编码是否存在
router.post("/exitsCode",function(req,res){
  var drugs = DB.get("Drugs");
  req.body.group_id = req.session.user[0].group_id;
  req.body.delete_flag = '0';
  drugs.where(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "验证药品编码是否出错" + err);
    }
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
//新增药品
router.post("/saveDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf("62") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  req.body.group_id = req.session.user[0].group_id;
  delete req.body.product_id;
  delete req.body.readonly;
  deleteParams(req.body);
  drugs.insertIncrement(req.body,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "新增药品出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//编辑药品
router.post("/editDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf("63") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  delete req.body.contacts_name;
  if(!req.body.contacts_id){
    delete req.body.contacts_id;
  }
  var flag = req.body.product_return_statistics_update;
  delete req.body.product_return_statistics_update;
  delete req.body.readonly;
  var drugs = DB.get("Drugs");
  drugs.update(req.body,'product_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "修改药品出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
  if(flag == "true"){
    var sales = DB.get("Sales");
    var sql = "update sales set sale_return_flag = '"+req.body.product_return_statistics+"' where product_code = '"+req.body.product_code+"'";
    sales.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "修改药品返款统计时，更新销售单出错" + err);
      }
    });
  }

});
//删除菜单
router.post("/deleteDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf("64") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  req.body.delete_flag = 1;
  drugs.update(req.body,'product_id',function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "删除药品出错" + err);
    }
    res.json({"code":"000000",message:null});
  });
});
//获取药品列表
router.post("/getDrugs",function(req,res){
  if(req.session.user[0].authority_code.indexOf("65") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  var salesSql = "select * from drugs ds left join (select distinct s.product_code as readonly from sales s where s.delete_flag = '0' and s.group_id = '"+req.session.user[0].group_id+"') sr "+
                 "on ds.product_code = sr.readonly where ds.delete_flag = '0' and ds.group_id = '"+req.session.user[0].group_id+"'";
  var sql = "select d.*,c.contacts_name from ("+salesSql+") d left join contacts c on d.contacts_id = c.contacts_id where 1=1";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.contactId){
    sql += " and d.contacts_id = "+req.body.data.contactId+""
  }
  if(req.body.data.product_medical_type){
    sql += " and d.product_medical_type = '"+req.body.data.product_medical_type+"'"
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
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
  sql = "select sbus.*,bus.business_name from ("+sql+") sbus left join business bus on sbus.product_business = bus.business_id ";
  drugs.countBySql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "查询药品列表，查询总数出错" + err);
    }
    req.body.page.totalCount = result;
    req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
    sql += " order by sbus.product_id desc limit " + req.body.page.start + "," + req.body.page.limit + "";
    drugs.executeSql(sql,function(err,result){
      if(err){
        logger.error(req.session.user[0].realname + "查询药品列表出错" + err);
      }
      req.body.page.data = result;
      res.json({"code":"000000",message:req.body.page});
    });
  });
});
//获取库存统计
router.post("/getStockNum",function(req,res){
  if(req.session.user[0].authority_code.indexOf("65") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var drugs = DB.get("Drugs");
  var sql = "select sum(d.stock*d.product_mack_price) mpn,sum(d.stock) sn from drugs d where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
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
  drugs.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "统计库存总量出量" + err);
    }
    res.json({"code":"000000",message:result[0]});
  });
});
// //获取药品列表
// router.get("/getDrugs",function(req,res){
//   var drugs = DB.get("Drugs");
//   var sql = "select * from drugs";
//   drugs.executeSql(sql,function(err,result){
    // for(var i = 0 ; i < result.length ;i++){
    //   var temp = "";
    //   pinyin(result[i].product_common_name, {
    //     style: "normal"
    //   }).forEach(function(i){
    //     temp+=i[0].substring(0,1);
    //   });
    //   var updateSql = "update drugs set product_name_pinyin = '"+temp+"' where product_id = "+result[i].product_id+"";
    //   drugs.executeSql(updateSql,function(err,result){});
    // }
//
//     res.json({"code":"000000",message:"success"});
//   });
// });
//获取生产企业，分组查询
router.post("/getProductMakesmakers",function(req,res){
  var drugs = DB.get("Drugs");
  var sql = "select d.product_makesmakers,d.product_supplier from drugs d where d.group_id = '"+req.session.user[0].group_id+"' group by d.product_makesmakers,d.product_supplier";
  drugs.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "药品管理，分组查询生产企业出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
//获取商业，分组查询
router.post("/getProductBusiness",function(req,res){
  var drugs = DB.get("Drugs");
  var sql = "select d.product_business from drugs d where d.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' group by d.product_business";
  drugs.executeSql(sql,function(err,result){
    if(err){
      logger.error(req.session.user[0].realname + "药品管理，分组查询商业出错" + err);
    }
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
