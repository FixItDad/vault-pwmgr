#!/usr/bin/python

# Functional tests for the main password manager page

# Currently targeting Firefox
# Depends on the vault configuration provided by the startdev.sh script.
# Depends on pytest-sourceorder to force test case execution order.
# TODO: configure vault data from pretest fixture.

import datetime
import pytest
import time

from pytest_sourceorder import ordered
from selenium import webdriver
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.common.by import By
from selenium.webdriver.support.select import Select
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

import testutils

# Test vault-pwmgr server to point to for tests
PWMGR_URL = "http://127.0.0.1:7080/"

HISTGROUP = testutils.HISTGROUP

# Used to store state information for multi-step tests. Generally tests should
# be independent, but some cases may depend on results returned earlier by the
# program under test. This can be used judiciously instead of than duplicating
# test code or having very long test cases that test multiple items.
state = {}

def _login_pw(driver, userid, userpw):
    """ Helper routine to log in by password with the supplied credentials. """
    loginid = driver.find_element_by_id("loginid")
    loginid.clear()
    loginid.send_keys(userid)

    loginpw = driver.find_element_by_id("loginpw")
    loginpw.clear()
    loginpw.send_keys(userpw)

    loginpw.submit()
    

@pytest.fixture(scope="module")
def webdriver_module():
    # Create a new instance of the browser driver at the module level
    driver = webdriver.Firefox()
    yield driver
    driver.quit()

@pytest.fixture
def driver(webdriver_module):
    # Set up the initial webdirver state for functions in this module.
    # These functions test post login functionality, so start with a
    # fresh login page and enter test user credentials.
    webdriver_module.get(PWMGR_URL)
    WebDriverWait(webdriver_module, 10).until(EC.title_contains("Vault Password Manager"))
    _login_pw(webdriver_module,'user1','user1pw')
    WebDriverWait(webdriver_module, 10).until(EC.presence_of_element_located((By.ID,"entrydetails")))
    WebDriverWait(webdriver_module, 10).until(EC.presence_of_element_located((By.TAG_NAME,"nav")))
    return webdriver_module



def ztest_navigation_visibility(driver):
    """ 
    Requirement: All authorized items should be reachable from the nav tree.
    Requirement: Nav tree initially shows only collection names.
    Gradually expand tree to reveal all 3 levels: collection, group, item
    """        
    nav = testutils.NavigationHelper(driver)

    # initially only collection names are visible
    visible = nav.visiblelist()
    assert visible == [('linuxadmin',), ('user1',)]

    # open a collection, groups in the collection should be visible
    nav.click(["linuxadmin"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin','webservers/'),
        ('user1',),
    ]

    # open other collection. All groups visible
    nav.click(["user1"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin','webservers/'),
        ('user1','Pauls Stuff/'),
        ('user1','network/'),
        ('user1','web/'),
    ]

    # open a group. Group items are visible
    nav.click(["user1","web/"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin','webservers/'),
        ('user1','Pauls Stuff/'),
        ('user1','network/'),
        ('user1','web/', 'google'),
        ('user1','web/', 'netflix'),
    ]

    # Close a group and open another
    nav.click(["user1","web/"])
    nav.click(["linuxadmin","webservers/"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin','webservers/','LoadBal'),
        ('linuxadmin','webservers/','extA'),
        ('linuxadmin','webservers/','extB'),
        ('user1','Pauls Stuff/'),
        ('user1','network/'),
        ('user1','web/'),
    ]

    #open the last group
    nav.click(["user1","Pauls Stuff/"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin','webservers/','LoadBal'),
        ('linuxadmin','webservers/','extA'),
        ('linuxadmin','webservers/','extB'),
        ('user1','Pauls Stuff/','$+dream'),
        ('user1','network/'),
        ('user1','web/'),
    ]

    # close a collection, all groups and items in the collection are hidden
    nav.click(["linuxadmin"])
    visible = nav.visiblelist()
    assert visible == [
        ('linuxadmin',),
        ('user1','Pauls Stuff/','$+dream'),
        ('user1','network/'),
        ('user1','web/'),
    ]

@ordered
class TestAddRemove(object):
    """ 
    """
    def test_add_item_from_initial(s,driver):
        """ Requirement: Add an item.
        Add from initial screen with blank fields.
        """
        nav = testutils.NavigationHelper(driver)
        form = testutils.ItemHelper(driver)

        # initially only collection names are visible
        visible = nav.visiblelist()
        assert visible == [('linuxadmin',), ('user1',),]

        assert form.fields == {
            "collectionid":"user1",
            "groupid":"",
            "notes":"",
            "password":"",
            "title":"",
            "url":"",
            "userid":"",
        }
        form.fields = {
            "collectionid":"user1",
            "groupid":"web",
            "title":"Facepalm",
            "url":"https://facepalm.com",
            "userid":"bob",
            "password":"bobknows",
            "notes":"Forget privacy!",
        }
        # Should be able to read the values back.
        assert form.fields == {
            "collectionid":"user1",
            "groupid":"web",
            "title":"Facepalm",
            "url":"https://facepalm.com",
            "userid":"bob",
            "password":"bobknows",
            "notes":"Forget privacy!",
        }
        form.add_new()
        assert form.message == "Added new entry web/Facepalm"

        # visible in nav tree?
        nav.click(["user1"])
        nav.click(["user1","web/"])
        assert nav.visible(('user1','web/', 'Facepalm'))


    def test_del_item_facepalm(s,driver):
        """ Requirements: Items can be deleted. Old items are moved 
        to an Archive group in the same collection. The item title contains a timestamp.
        Form fields are cleared. A delete message is shown.
        """
        nav = testutils.NavigationHelper(driver)

        nav.click(["user1"])
        nav.click(["user1","web/"])
        assert nav.visible(('user1','web/', 'Facepalm'))
        nav.click(["user1","web/","Facepalm"])
        form = testutils.ItemHelper(driver)
        assert form.fields == {
            "collectionid":"user1",
            "groupid":"web",
            "notes":"Forget privacy!",
            "password":"bobknows",
            "title":"Facepalm",
            "url":"https://facepalm.com",
            "userid":"bob",
        }, "Expected item values displayed when selected"
        
        form.delete()
        delete_ts = datetime.datetime.utcnow()
        WebDriverWait(driver, 5).until(
            EC.text_to_be_present_in_element(
                (By.ID,"mainmsg"),"Deleted entry web/Facepalm"))

        assert form.fields == {
            "collectionid":"user1",
            "groupid":"",
            "notes":"",
            "password":"",
            "title":"",
            "url":"",
            "userid":"",
        }, "Requirement: Fields are cleared after delete"
        
        assert form.message == "Deleted entry web/Facepalm", "Requirement: delete message displayed"

        time.sleep(1) # Nav tree needs extra time to update
        visible = nav.visiblelist()
        assert visible == [
            (u'linuxadmin',),
            (u'user1',HISTGROUP),
            (u'user1',u'Pauls Stuff/'),
            (u'user1',u'network/'),
            (u'user1',u'web/', u'google'),
            (u'user1',u'web/', u'netflix'),
        ], "Archive group is visible in nav tree"

        nav.click(["user1", HISTGROUP])
        title = nav.findarchived(delete_ts, ('user1','web','Facepalm') )
        assert title is not None, "Requirement: deleted entry is in archive group."
        # Stash title name for later test step
        state["test_del_item_facepalm_title"] = title

        
    def test_del_archived_item_facepalm(s,driver):
        """ Requirements: Items can be deleted from the archive group.
        """
        nav = testutils.NavigationHelper(driver)
        form = testutils.ItemHelper(driver)

        nav.click(["user1"])
        nav.click(["user1", HISTGROUP])
        title = state["test_del_item_facepalm_title"]
        del state["test_del_item_facepalm_title"]

        nav.click(("user1", HISTGROUP, title))
        assert form.fields == {
            "collectionid":"user1",
            "groupid":HISTGROUP[:-1],
            "notes":"Forget privacy!",
            "password":"bobknows",
            "title":title,
            "url":"https://facepalm.com",
            "userid":"bob",
        }, "Archived entry values are as expected."

        form.delete()
        WebDriverWait(driver, 5).until(
            EC.text_to_be_present_in_element(
                (By.ID,"mainmsg"),"Deleted entry %s%s" % (HISTGROUP, title)))

        assert form.fields == {
            "collectionid":"user1",
            "groupid":"",
            "notes":"",
            "password":"",
            "title":"",
            "url":"",
            "userid":"",
        }, "Requirement: fields cleared after delete (archived entry)"

        assert nav.hidden(('user1', HISTGROUP, title)), "Requirement: item removed from archive"


def ztest_delete_item(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_group(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_notes(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_password(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_title(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_url(driver):
    """  """
    assert False, 'not implemented'

def ztest_modify_item_userid(driver):
    """  """
    assert False, 'not implemented'

def ztest_clear_item_fields(driver):
    """  """
    assert False, 'not implemented'

def ztest_shared_item_visibility(driver):
    """  """
    assert False, 'not implemented'

