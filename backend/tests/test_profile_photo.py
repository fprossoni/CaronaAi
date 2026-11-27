import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi import HTTPException

from app.api import users


class PhotoRequest:
    def __init__(self, data):
        self.data = data

    async def stream(self):
        yield self.data

    def url_for(self, name, **params):
        return "http://localhost/users/photos/" + params["filename"]


class ProfilePhotoTest(unittest.IsolatedAsyncioTestCase):
    async def test_upload_and_retrieve(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(users, "PHOTO_DIR", Path(directory)):
                data = b"\xff\xd8\xfftest\xff\xd9"
                result = await users.upload_photo(PhotoRequest(data), object())
                filename = result["photo_url"].rsplit("/", 1)[1]
                response = users.profile_photo(filename)
                self.assertEqual(Path(response.path).read_bytes(), data)
                self.assertEqual(response.media_type, "image/jpeg")

    async def test_invalid_and_oversized_uploads(self):
        for data, status in [(b"not an image", 400), (b"x" * (users.MAX_PHOTO_BYTES + 1), 413)]:
            with self.assertRaises(HTTPException) as caught:
                await users.upload_photo(PhotoRequest(data), object())
            self.assertEqual(caught.exception.status_code, status)

    def test_rejects_paths_outside_photo_directory(self):
        with self.assertRaises(HTTPException) as caught:
            users.profile_photo("../../private.jpg")
        self.assertEqual(caught.exception.status_code, 404)
