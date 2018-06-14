var express = require("express");
var router = express.Router();

//新增联系人
router.post("/saveRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf("78") > 0 || req.session.user[0].authority_code.indexOf("80") > 0){
    var refunds = DB.get("Refunds");
    if(req.body.refunds_should_time){
      req.body.refunds_should_time = new Date(req.body.refunds_should_time).format('yyyy-MM-dd');
    }else{
      req.body.refunds_should_time = null;
    }
    if(req.body.refunds_real_time){
      req.body.refunds_real_time = new Date(req.body.refunds_real_time).format('yyyy-MM-dd');
    }else{
      req.body.refunds_real_time = null;
    }
    delete req.body.refunds_id;
    refunds.insertIncrement(req.body,function(err,result){
      console.log(err);
      res.json({"code":"000000",message:result});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
});
//编辑销售记录
router.post("/editRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf("78") > 0 || req.session.user[0].authority_code.indexOf("80") > 0){
    var refunds = DB.get("Refunds");
    if(req.body.refunds_should_time){
      req.body.refunds_should_time = new Date(req.body.refunds_should_time).format('yyyy-MM-dd');
    }else{
      req.body.refunds_should_time = null;
    }
    if(req.body.refunds_real_time){
      req.body.refunds_real_time = new Date(req.body.refunds_real_time).format('yyyy-MM-dd');
    }else{
      req.body.refunds_real_time = null;
    }
    refunds.update(req.body,'refunds_id',function(err,result){
      res.json({"code":"000000",message:null});
    });
  }else{
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
});
//获取备货列表
router.post("/getPurchaseRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf("79") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var refunds = DB.get("Refunds");
  var sql = getPurchasesSql(req);
  refunds.countBySql(sql,function(err,result){
    var numSql = "select sum(num.refunds_should_money) as rsm,sum(num.refunds_real_money) as rrm,sum(num.service_charge) as sc from ( " + sql + " ) num";
    refunds.executeSql(numSql,function(err,refund){
      req.body.page.rsm = refund&&refund[0].rsm?refund[0].rsm.toFixed(2):0;
      req.body.page.rrm = refund&&refund[0].rrm?refund[0].rrm.toFixed(2):0;
      req.body.page.sc = refund&&refund[0].sc?refund[0].sc.toFixed(2):0;
      req.body.page.totalCount = result;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by p.time desc,p.purchase_id desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      refunds.executeSql(sql,function(err,result){
        req.body.page.data = result;
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
function getPurchasesSql(req){
  var prsql = "select * from purchase pr left join refunds r on pr.purchase_id = r.purchases_id where pr.make_money_time is not null";
  if(req.body.data.status){
    var s = req.body.data.status=="已返"?"r.refunds_real_time is not null && r.refunds_real_money is not null":"r.refunds_real_time is null && (r.refunds_real_money is null || r.refunds_real_money = '')";
    prsql += " and "+s;
  }
  if(req.body.data.returnTime){
    var start = new Date(req.body.data.returnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.returnTime[1]).format("yyyy-MM-dd");
    prsql += " and ((DATE_FORMAT(r.refunds_should_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(r.refunds_should_time,'%Y-%m-%d') <= '"+end+"') || r.refunds_should_time is null)";
  }
  var sql = "select p.*,d.product_code,d.product_floor_price,d.product_high_discount,d.contacts_name,d.product_return_explain,d.product_type,d.product_return_money,d.product_return_discount,d.product_common_name,d.product_specifications,d.product_supplier,d.product_makesmakers,d.product_unit,d.product_packing"+
            " from ("+prsql+") p left join (select dd.*,c.contacts_name from drugs dd left join contacts c on dd.contacts_id = c.contacts_id) d on p.drug_id = d.product_id where p.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"'";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.contactId){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
  }
  if(req.body.data.product_code){
    sql += " and d.product_code = '"+req.body.data.product_code+"'"
  }
  if(req.body.data.time){
    var start = new Date(req.body.data.time[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.time[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(p.time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(p.time,'%Y-%m-%d') <= '"+end+"'";
  }
  return sql;
}
//获取返款
router.post("/getSaleRefunds",function(req,res){
  if(req.session.user[0].authority_code.indexOf("80") < 0){
    res.json({"code":"111112",message:"无权限"});
    return ;
  }
  var refunds = DB.get("Refunds");
  var sql = getQuerySql(req);
  refunds.countBySql(sql,function(err,result){
    var numSql = "select sum(num.refunds_should_money) as rsm,sum(num.refunds_real_money) as rrm,sum(num.service_charge) as sc from ( " + sql + " ) num";
    refunds.executeSql(numSql,function(err,refund){
      req.body.page.rsm = refund&&refund[0].rsm?refund[0].rsm.toFixed(2):0;
      req.body.page.rrm = refund&&refund[0].rrm?refund[0].rrm.toFixed(2):0;
      req.body.page.sc = refund&&refund[0].sc?refund[0].sc.toFixed(2):0;
      req.body.page.totalCount = result;
      req.body.page.totalPage = Math.ceil(req.body.page.totalCount / req.body.page.limit);
      sql += " order by s.bill_date desc,s.sale_id desc limit " + req.body.page.start + "," + req.body.page.limit + "";
      refunds.executeSql(sql,function(err,result){
        req.body.page.data = result;
        res.json({"code":"000000",message:req.body.page});
      });
    });
  });
});
function getQuerySql(req){
  var sh = "select sh.*,h.hospital_name from sales sh left join hospitals h on sh.hospital_id = h.hospital_id where sh.group_id = '"+req.session.user[0].group_id+"' ";
  sh = "select * from ("+sh+") sr left join refunds r on sr.sale_id = r.sales_id where 1=1";
  if(req.body.data.status){
    var s = req.body.data.status=="已返"?"r.refunds_real_time is not null && r.refunds_real_money is not null":"r.refunds_real_time is null && (r.refunds_real_money is null || r.refunds_real_money = '')";
    sh += " and "+s;
  }
  var sql = "select s.*,d.product_type,d.contacts_name,d.product_business,d.product_return_explain,d.product_return_money,d.product_return_discount,d.product_common_name,d.product_specifications,d.product_makesmakers,d.product_unit,d.product_packing"+
            " from ("+sh+") s left join (select dd.*,c.contacts_name from drugs dd left join contacts c on dd.contacts_id = c.contacts_id) d on s.product_code = d.product_code where s.delete_flag = '0' and d.group_id = '"+req.session.user[0].group_id+"' ";
  sql += " and d.product_type in ('佣金')";
  if(req.body.data.productCommonName){
    sql += " and (d.product_common_name like '%"+req.body.data.productCommonName+"%' or d.product_name_pinyin like '%"+req.body.data.productCommonName+"%')";
  }
  if(req.body.data.contactId){
    sql += " and d.contacts_id = '"+req.body.data.contactId+"'"
  }
  if(req.body.data.business){
    sql += " and d.product_business = '"+req.body.data.business+"'"
  }
  if(req.body.data.salesTime){
    var start = new Date(req.body.data.salesTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.salesTime[1]).format("yyyy-MM-dd");
    sql += " and DATE_FORMAT(s.bill_date,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.bill_date,'%Y-%m-%d') <= '"+end+"'";
  }
  if(req.body.data.returnTime){
    var start = new Date(req.body.data.returnTime[0]).format("yyyy-MM-dd");
    var end = new Date(req.body.data.returnTime[1]).format("yyyy-MM-dd");
    sql += " and ((DATE_FORMAT(s.refunds_should_time,'%Y-%m-%d') >= '"+start+"' and DATE_FORMAT(s.refunds_should_time,'%Y-%m-%d') <= '"+end+"') || s.refunds_should_time is null)";
  }
  return sql;
}
//获取联系人列表
router.post("/getAllContacts",function(req,res){
  var contacts = DB.get("Contacts");
  req.body.group_id = req.session.user[0].group_id;
  req.body.delete_flag = 0;
  contacts.where(req.body,function(err,result){
    res.json({"code":"000000",message:result});
  });
});
module.exports = router;
