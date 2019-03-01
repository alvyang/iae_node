module.exports = {
	key:'PurchaseRecovery',
	name:'purchase_recovery',
	fields:['purchaserecovery_id',
					'purchaserecovery_time',
					'purchaserecovery_number',
					'purchaserecovery_money',
					'purchaserecovery_product_code',
					'purchaserecovery_group_id',
					'purchaserecovery_delete_flag',
					'purchaserecovery_user_id',
					'purchaserecovery_batch_stock_time',
					'purchaserecovery_batch_number',
					'purchaserecovery_create_time',
					'purchaserecovery_purchase_id',//这两个字段，用于删除时，更新库存
					'purchaserecovery_drug_id',
					'purchaserecovery_return_money_time']
};
