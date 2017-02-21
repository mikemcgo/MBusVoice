from extensions import *
from flask import *

edit_favorites = Blueprint('edit_favorites', __name__, template_folder='templates')

@edit_favorites.route('/api/v1/changeprimary', methods=["POST"])
def change_primary():
	req_json = request.get_json()
	
	malformed_request_error = verify_json_parameters(['alexa_id', 'stop_alias'], req_json)

	if malformed_request_error is not None:
		return malformed_request_error

	# ensure user exists -- need db access

	# ensure the user already has this alias set in the database -- need db access

	# Update -- need db access

	return jsonify(req_json), 200

@edit_favorites.route('/api/v1/deletefavorite', methods=["POST"])
def delete_favorite():
	req_json = request.get_json()

	malformed_request_error = verify_json_parameters(['alexa_id', 'stop_alias'], req_json)

	if malformed_request_error is not None:
		return malformed_request_error

	# check that the user exists -- need db access

	# check that this data exists in user home or destinations
		# throw error if not

	# if deleting primary
		# clear primary field

	# delete item from field

	return jsonify(alexa_id=req_json['alexa_id']), 200


