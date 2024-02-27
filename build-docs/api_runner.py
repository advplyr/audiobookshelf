# This Python script is designed to ping the dev server to allow
# for validation of the OpenAPI schema. Eventually this should
# be a nice thing written out in chai or something to incorporate
# to the normal ABS testing framework.
#
# Right now, this depends on `wiretap` (https://pb33f.io/wiretap/)
# being installed and set up. wiretap acts as a proxy to validate
# responses against the defined OpenAPI schema.

import requests
import json
import time
from copy import deepcopy

def write_to_json(fname, data):
  json_obj = json.dumps(data, indent=4)
  with open(fname,'w') as f:
    f.write(json_obj)

# Server specific information
server_ip = "http://localhost"
server_port = 9090

###########################
### Setup
###########################
BASEURL = f"{server_ip}:{server_port}"
HEADERS = {'Content-Type': 'application/json'}

def ping_server():
  url = f"{BASEURL}/ping"

  # Post response
  r = requests.get(url = url, headers = HEADERS)

def get_token():
  url = f"{BASEURL}/login"
  params = {'username': 'root', 'password': 'password'}

  # Post response
  r = requests.post(url = url, json = params)
  data = r.json()

  # Get the token out
  my_token = data['user']['token']

  return my_token

#ping_server()
# Update HEADERS to include token
HEADERS['Authorization'] = f"Bearer {get_token()}"

# Get all libraries
def get_libraries():
  url = f"{BASEURL}/api/libraries"

  # Get response
  r = requests.get(url = url, headers = HEADERS)
  data = r.json()

  # Get library IDs
  libs = []
  for lib in data['libraries']:
    libs.append(lib['id'])

  return libs

library_ids = get_libraries()


# Get books from library
def get_books(library_id, count=None):
  url = f"{BASEURL}/api/libraries/{library_id}/items"

  params = {}
  if count:
    params = {'limit': count}

  # Get response
  r = requests.get(url = url, headers = HEADERS, json = params)
  data = r.json()

  book_ids = []
  for items in data['results']:
    book_ids.append(items['id'])
  
  return book_ids

books = get_books(library_ids[0])

# Get a library item
def get_item(id):
  url = f"{BASEURL}/api/items/{id}"
  # Get response
  r = requests.get(url = url, headers = HEADERS)
  data = r.json()

  return data

print("Getting book details!")
resp = get_item(books[0])
#write_to_json("book.json", resp)

###########################
### Collections tests
###########################

def create_collection(library_id, collection_name, desc=None, books=None):
  url = f"{BASEURL}/api/collections"

  params = {'libraryId': library_id,
            'name': collection_name}
  if desc:
    params['description'] = desc
  if books:
    params['books'] = books

  json_data = json.dumps(params)
  print(json_data)
  # Post response
  r = requests.post(url = url, headers = HEADERS, data = json_data)

  print(r.request.url)
  print(r.request.headers)
  print(r.request.body)

  data = r.json()

  return data

def get_all_collections():
  url = f"{BASEURL}/api/collections"

  # Post response
  r = requests.get(url = url, headers = HEADERS)
  data = r.json()
  print(r.request.url)
  print(r.request.headers)
  print(r.request.body)

  return data

def get_collections(library_id):
  url = f"{BASEURL}/api/libraries/{library_id}/collections"

  # Get response
  r = requests.get(url = url, headers = HEADERS)
  data = r.json()

  colls = []
  for item in data['results']:
    colls.append(item['id'])

  return colls

def update_collections(id, books):
  url = f"{BASEURL}/api/collections/{id}"
  print(books)

  # Only update the name
  data = {'name': 'New collection'}
  r = requests.patch(url = url, headers = HEADERS, json = data)

  # Only update the description
  data = {'description': 'New description'}
  r = requests.patch(url = url, headers = HEADERS, json = data)

  # Only update the books
  data = {'books': books}
  r = requests.patch(url = url, headers = HEADERS, json = data)

  # Update name and description
  data = {'name': 'New collection',
          'description': 'New description'}
  r = requests.patch(url = url, headers = HEADERS, json = data)

  # Update name and books
  data = {'name': 'New collection',
          'books': books}
  r = requests.patch(url = url, headers = HEADERS, json = data)

  # Update description and books
  data = {'description': 'Second description',
          'books': books}
  r = requests.patch(url = url, headers = HEADERS, json = data)

  # Update all things
  data = {'name': 'Last collection',
          'description': 'Last description',
          'books': books}
  r = requests.patch(url = url, headers = HEADERS, json = data)

def collection_add_book(id, book):
  url = f"{BASEURL}/api/collections/{id}/book"
  data = {'id': book}
  r = requests.post(url = url, headers = HEADERS, json = data)

def collection_delete_book(id, book):
  url = f"{BASEURL}/api/collections/{id}/book/{book}"
  r = requests.delete(url = url, headers = HEADERS)

def collection_add_book_batch(id, books):
  url = f"{BASEURL}/api/collections/{id}/batch/add"
  data = {'books': books}
  r = requests.post(url = url, headers = HEADERS, json = data)

def collection_remove_book_batch(id, books):
  url = f"{BASEURL}/api/collections/{id}/batch/remove"
  data = {'books': books}
  r = requests.post(url = url, headers = HEADERS, json = data)

def delete_collections(id):
  url = f"{BASEURL}/api/collections/{id}"

  # Delete response
  r = requests.delete(url = url, headers = HEADERS)

if True:
  resp = create_collection(library_ids[0], "First None", None, None)
  descriptions = [None, "First description", "Hello, here we go with some extra things."]
  book_arrs    = [None, [books[0]], books[1:3], books[3:7]]
  
  #descriptions = [None]
  descriptions = [None, descriptions[1]]
  book_arrs    = [None, book_arrs[2]]

  title_idx = 0
  for desc in descriptions:
    for book in book_arrs:
      title = f"Col {title_idx}"
      print(f"Creating collection {title_idx}")
      resp = create_collection(library_ids[0], title, desc, book)
      print("Created Collection with following info:")
      print(f"  Title: {title}")
      if desc:
        print(f"  Description: {desc}")
      if book:
        print(f"  Books: {len(book)}")
      #write_to_json(f"collection_{title_idx}.json", resp)
  
      #input("Press enter to continue...\n")
      title_idx += 1
  
  print("Getting collections")
  # Get all collections in library
  collections = get_collections(library_ids[0])

  print("Updating a collection")
  update_collections(collections[0], books[6:])
  
  print("Add book to collection")
  collection_add_book(collections[0], books[0])
  collection_add_book(collections[0], books[0])
  collection_add_book("aoeu", books[0])
  collection_add_book(collections[0], "aoeu8a56oue")
  
  print("Delete book from collection")
  collection_delete_book(collections[0], books[0])
  collection_delete_book(collections[0], books[0])
  collection_delete_book("yfgcr", books[0])
  collection_delete_book(collections[0], "aoeu8a56oue")
  
  print("Batch add and remove books to/from collection")
  collection_add_book_batch(collections[0], books[0:3])
  collection_add_book_batch(collections[0], books[0:3])
  collection_remove_book_batch(collections[0], books[0:3])
  collection_remove_book_batch(collections[0], books[0:3])
  collection_add_book_batch("aoeui", books[0:3])
  collection_remove_book_batch("aoeui", books[0:3])
  collection_add_book_batch(collections[0:3], [])
  collection_remove_book_batch(collections[0:3], [])
  
  print("Deleting collections")
  # Delete all collections
  for collection in collections:
    delete_collections(collection)