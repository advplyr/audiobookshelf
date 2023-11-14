# Python 3.7

##############
# Summary
##############
# This script copies existing translations between the Audiobookshelf server and app repos.
# Both repositiories must be cloned locally.

# The relative path to both repositories is stored in `string_syncer_paths.txt` in this same
# directory and is not tracked by Git (so there is not a hard coded path when you clone the
# file).

##############
# Rules
##############
# If an English string exists in BOTH repositories (both the key and value are identical) and
# a translation of the string does not exist in ONE repository, the translation is copied.

# If a language translation exists in ONE repository, the translation is copied to the other
# repository. After copying, any keys which do not appear in the English resource file
# (`en-us/strings.json`) are removed from the destination repository to handle server/app
# specific strings.

# If the English key exists in both repositories but the value is not identical, the translations
# are not copied to help ensure there is not a name conflict.



##############
# Functions
##############

import sys
import os
import json
import shutil

# Return a dictionary of all key/values in a directory
# (supports multiple files in case the JSON is broken into multiple files)
# Throws an error if a key exists more than once.
def load_json_files(directory_path):
    data = {}
    for filename in os.listdir(directory_path):
        if filename.endswith('.json'):
            file_path = os.path.join(directory_path, filename)
            with open(file_path, 'r') as file:
                file_data = json.load(file)
                for key in file_data:
                    if key in data:
                        raise ValueError(f'Duplicate key found: {key} in {filename}')
                data.update(file_data)
    return data

# Return matching key/value pairs from two dicts
def dict_same(dict1, dict2):
    result = {}

    for k,v in dict1.items():
        if k in dict2 and dict2[k] == v:
            result[k] = v
    
    return result

# Get list of translations which need to be added between repositories
def translations_to_add(english_dict, server_path, app_path):
    # Load the data
    with open(server_path, 'r') as file:
        server_dict = json.load(file)
    with open(   app_path, 'r') as file:
        app_dict    = json.load(file)

    app_adds    = 0
    server_adds = 0

    # Copy from server to app
    for key, value in server_dict.items():
        if (key in english_dict) and (key not in app_dict):
            app_adds      += 1
            app_dict[key] = value

    # Copy from app to server
    for key, value in app_dict.items():
        if (key in english_dict) and (key not in server_dict):
            server_adds      += 1
            server_dict[key] = value

    # Store the data
    with open(server_path, 'w') as file:
        json.dump(server_dict, file, indent=2, sort_keys=True)
    with open(   app_path, 'w') as file:
        json.dump(   app_dict, file, indent=2, sort_keys=True)

    file_path = '/'.join(server_path.split("/")[-2:])
    print(f"File: {file_path}\t\t\tAdded {app_adds} to the app and {server_adds} to the server")


# Given the English lookup and a translation file, remove any keys that do
# not exist in the English lookup
# 
# Return how many keys were removed
def remove_nonexistant(english_dict, translation_path, repo=None):
    keys_removed = 0

    # Load data
    with open(translation_path, 'r') as file:
        file_data = json.load(file)

    # Remove keys which don't exist in English
    for key in file_data:
        if key not in english_dict:
            file_data.pop(key)
            keys_removed += 1

    # Write back to file
    with open(translation_path, 'w') as file:
        json.dump(file_data, file, indent=2, sort_keys=True)

    if repo and keys_removed > 0:
        print(f"Removed {keys_removed} from {repo} in {translation_path}")

    return keys_removed


# Write JSON object to file
def write_to_file(dictionary, path):
    with open(path, "w") as file:
        json.dump(dictionary, file, indent=2, sort_keys=True)

# Check that directory exists
def is_dir(path):
    return os.path.exists(path) and os.path.isdir(path)

# Get list of all translation languages
def get_languages(path):
    langs = [d for d in os.listdir(path) if os.path.isdir(os.path.join(path, d))]
    langs.remove("en-us")
    return langs

# Create missing language directories
def create_directories_from_list(directory_list, base_directory):
    for directory_name in directory_list:
        # Create the full path by joining the base directory and the directory name
        full_path = os.path.join(base_directory, directory_name)
        # Check if the directory already exists; if not, create it
        if not os.path.exists(full_path):
            os.makedirs(full_path)

# Copy all missing translation files between the two repositories
def copy_missing_files(source_dir, target_dir):
    if not os.path.exists(source_dir) or not os.path.exists(target_dir):
        raise ValueError("Source and target directories must exist.")

    for root, _, files in os.walk(source_dir):
        for filename in files:
            source_path = os.path.join(root, filename)
            target_path = os.path.join(target_dir, filename)
                                                            
            if not os.path.exists(target_path):
                shutil.copy(source_path, target_path)
                print(f"Copied {source_path} to {target_path}")

# Given two server directories, Do The Thing!
def main():
    stored_path = "string_syncer_paths.txt"

    # Check to see if the repository paths are set and exist
    try:
        with open(stored_path, 'r') as file:
            repos = json.load(file)
        print("Loaded repo paths from {stored_path}. To use a different path, please delete this file.")
    finally:
        # File does not exist, need command line arguments
        if len(sys.argv) < 3:
            print("Stored repositories not found and no command line arguments given.")
            print("Command usage:")
            print("  python string_syncer.py [audiobookshelf string dir] [audiobookshelf-app string dir]")
            return 1

        repos = {'server': sys.argv[1], 'app': sys.argv[2]}
        # Store the repo paths
        with open(stored_path,'w') as file:
            json.dump(repos, file, indent=2)

    # Load English resource files
    server_english = load_json_files( repos['server'] + "/en-us" )
    app_english    = load_json_files( repos['app']    + "/en-us" )

    # Get identical English key/value pairs
    english_common = dict_same(server_english, app_english)
    
    # Get list of languages
    server_langs   = get_languages( repos['server'] )
    app_langs      = get_languages( repos['app']    )

    all_langs      = sorted(list(set(server_langs) | set(app_langs)))

    print(all_langs)

    # Create all language directories in both repositories
    print(repos)
    create_directories_from_list( all_langs, repos['server'] )
    create_directories_from_list( all_langs, repos['app']    )

    # Copy all missing translation files
    for lang in all_langs:
        server_path = repos['server'] + "/" + lang
        app_path    = repos['app']    + "/" + lang

        copy_missing_files( server_path,    app_path )
        copy_missing_files(    app_path, server_path )

        # After copying the files, update all files for language
        for filename in os.listdir(server_path):
            if filename.endswith(".json"):
                server_file = server_path + "/" + filename
                app_file    = app_path    + "/" + filename

                # Remove extra keys
                remove_nonexistant(server_english, server_file, repo="server")
                remove_nonexistant(   app_english,    app_file, repo="app"   )

                # Add identical key/values
                translations_to_add(english_common, server_file, app_file)

    print("All done")

if __name__ == "__main__":
    main()
