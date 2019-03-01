module.exports = {
	key:'PurchaseLoss',
	name:'purchase_loss',
	fields:['purchaseloss_id',
					'purchaseloss_time',
					'purchaseloss_number',
					'purchaseloss_money',
					'purchaseloss_product_code',
					'purchaseloss_group_id',
					'purchaseloss_delete_flag',
					'purchaseloss_user_id',
					'purchaseloss_batch_stock_time',
					'purchaseloss_batch_number',
					'purchaseloss_create_time',
					'purchaseloss_purchase_id',//这两个字段，用于删除时，更新库存
					'purchaseloss_drug_id']
};
