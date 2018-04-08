#!/usr/bin/python

# Functional tests for the main password manager page

# Currently targeting Firefox
# Depends on the vault configuration provided by the startdev.sh script. 
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

# Test vault-pwmgr server to point to for tests
PWMGR_URL = "http://127.0.0.1:7080/"

HISTGROUP = u'Archive/'

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


class ItemHelper(object):
    """ 
    Helper class for examining and manipulating the item form
    """
    def __init__(s,driver):
        """ Expects a Selenium style web browser driver """
        s.driver = driver
        s.form = driver.find_element_by_id("itemform")
        assert s.form is not None

    # The valid key values for item dictionaries
    TEXT_FIELDS = ("groupid","notes","password","title","url","userid",)
    SEL_FIELDS = ("collectionid",)
    
    def set_fields(s, itemdict):
        """ Fill item fields with values from itemdict. Keys must match
        values from TEXT_FIELDS. Non-matching fields are ignored. """
        for field in s.TEXT_FIELDS:
            if field not in itemdict: continue
            element = s.form.find_element_by_id(field)
            element.send_keys(itemdict[field])
        for field in s.SEL_FIELDS:
            if field not in itemdict: continue
            element = Select(s.form.find_element_by_id(field))
            element.select_by_visible_text(itemdict[field])

    def get_fields(s):
        """ Return a dictionary with current form field values. """
        vals = {}
        for field in s.TEXT_FIELDS:
            element = s.form.find_element_by_id(field)
            vals[field] = element.get_attribute("value")
        for field in s.SEL_FIELDS:
            element = Select(s.form.find_element_by_id(field))
            vals[field] = element.first_selected_option.text
        return vals

    fields = property(get_fields, set_fields)

    @property
    def message(s):
        return s.form.find_element_by_id("mainmsg").text

    def add_new(s):
        """ Clicks the Add New button """
        s.form.find_element_by_id("b-new").click()

    def delete(s):
        """ Clicks the Delete button then OKs the 'Are you sure?' dialog. 
        A WebDriverWait is recommended after calling this function.
        """
        s.form.find_element_by_id("b-delete").click()
        s.driver.switch_to.alert.accept()

class NavigationHelper(object):
    """ 
    Helper class for examining and manipulating the navigation tree of 
    collections, groups and items.
    The click, visiblelist, visible, and archived functions are most commonly used.
    """
    def __init__(s,driver):
        """ Expects a Selenium style web browser driver """
        s.driver = driver
        s.nav = driver.find_element_by_tag_name("nav")
        assert s.nav
        
    def archived(s, del_ts, path, limit=5):
        """ Check if an item is in the archive group. The path is the original (collection
        group, title) tuple. The archive entry must be within 'limit' seconds of the ts 
        datetime value. 
        This function is needed to allow for the difference in timestamps when the
        item is deleted and measured by the test program. It will prevent the test 
        case from failing intermittently if the clock rolls between the 1 timestamps.
        """
        prefix = "{1}|{2}|".format(*path)
        for item in s.items(s.group(s.collection(path[0]), HISTGROUP)):
            if item.text.startswith(prefix):
                ts_str = item.text[len(prefix):]
                item_ts = datetime.datetime.strptime(ts_str,'%Y%m%d%H%M%S')
                print "item_ts:",item_ts
                if (del_ts - item_ts).total_seconds() < limit:
                    return True
        return False

    def click(s, path):
        """ Generate a click on a navigation tree element """
        assert len(path) > 0 and len(path) < 4

        collection = s.collectionname(path[0])
        assert collection
        if len(path) == 1:
            s._click(collection)
            return

        group = s.groupname(collection.find_element_by_xpath('..'), path[1])
        assert group
        if len(path) == 2:
            s._click(group)
            return

        item = s.item(group.find_element_by_xpath('..'), path[2])
        assert item
        s._click(item)
        return

    def collection(s, name):
        """ Return a collection webelement by name or None if not found """
        for element in s.nav.find_elements_by_class_name("collectionname"):
            if element.text == name:
                return element.find_element_by_xpath('..')
        return None

    def collectionname(s, name):
        """ Return a collection webelement by name or None if not found.
        The collection element is the parent of the collectionname element
        """
        for element in s.nav.find_elements_by_class_name("collectionname"):
            if element.text == name:
                return element
        return None

    def collections(s):
        """ Return a dictionary of collectionname_webelement:collection_webelement pairs. 
        Returns empty dictionary if none found.
        """
        retval = {}
        for element in s.nav.find_elements_by_class_name("collectionname"):
            retval[element] = element.find_element_by_xpath('..')
        return retval

    def group(s, collection, name):
        """ Return a group webelement by name or None if not found """
        for element in collection.find_elements_by_class_name("groupname"):
            if element.text == name:
                return element.find_element_by_xpath('..')
        return None

    def groupname(s, collection, name):
        """ Return a group webelement by name or None if not found.
        The group element is the parent of the groupname element.
        """
        for element in collection.find_elements_by_class_name("groupname"):
            if element.text == name:
                return element
        return None

    def groups(s, collection):
        """ Return a dictionary of groupname_webelement:group_webelement pairs. 
        Returns empty dictionary if none found. collection is the containing webelement. 
        """
        retval = {}
        for element in collection.find_elements_by_class_name("groupname"):
            retval[element] = element.find_element_by_xpath('..')
        return retval

    def hidden(s, path):
        """ Return True if an item is not visible in the nav tree. The path
        is (collection, group, title) tuple. """
        # Vue does not fully build the nav tree immediately, so we must allow for
        # elements to be missing in addition to being present but not displayed.
        assert len(path) > 0 and len(path) < 4

        collection = s.collectionname(path[0])
        if not collection: return True
        if len(path) == 1:
            return not collection.is_displayed()

        group = s.groupname(collection.find_element_by_xpath('..'), path[1])
        if not group: return True
        if len(path) == 2:
            return not group.is_displayed()

        item = s.item(group.find_element_by_xpath('..'), path[2])
        if not item: return True
        return not item.is_displayed()

    def item(s, group, name):
        """ Return an item web element by name or None if not found. 
        Unlike groupname and collectionname, itemname elements are not contained
        by an item element. group is the containing webelement. 
        """
        for element in group.find_elements_by_class_name("itemname"):
            if element.text == name:
                return element
        return None
        
    def items(s, group):
        """ Return a list of itemname_webelements. Empty list if none found. group is
        the containing webelement. """
        return group.find_elements_by_class_name("itemname")

    def visible(s, path):
        """ Returns True if an item is visible in the nav tree. The path 
        is (collection, group, title) tuple. 
        """
        assert len(path) > 0 and len(path) < 4
        print "Looking for ",path
        collection = s.collectionname(path[0])
        if not collection: return False
        print "Found collection", collection.text
        if len(path) == 1:
            return collection.is_displayed()

        group = s.groupname(collection.find_element_by_xpath('..'), path[1])
        if not group: return False
        print "Found group", group.text
        if len(path) == 2:
            return group.is_displayed()

        item = s.item(group.find_element_by_xpath('..'), path[2])
        if not item: return False
        return item.is_displayed()

    def visiblelist(s):
        """ Returns a sorted list of tuples in the nav tree that are currently visible.
        The tuples can be of the form ("collection",), ("collection", "group"), or
        ("collection", "group", "item"). No expansion of the tree items is done. 
        """
        visible = []
        collectionmap = s.collections()
        assert len(collectionmap) > 0
        for cname in collectionmap.keys():
            collection_expanded = False
            groups = s.groups(collectionmap[cname])
            for groupname in groups.keys():
                group_expanded = False
                items = s.items(groups[groupname])
                for item in items:
                    if item.is_displayed():
                        visible.append( (cname.text, groupname.text, item.text) )
                        collection_expanded = True
                        group_expanded = True
                if groupname.is_displayed() and not group_expanded:
                    visible.append( (cname.text, groupname.text) )
                    collection_expanded = True
            if not collection_expanded:
                visible.append( (cname.text,) )
        return sorted(visible)
        
    def _click(s, element):
        # Reload nav tree after clicking an element
        element.click()
        time.sleep(0.5)
        s.nav = s.driver.find_element_by_tag_name("nav")


def ztest_navigation_visibility(driver):
    """ 
    Requirement: All authorized items should be reachable from the nav tree.
    Requirement: Nav tree initially shows only collection names.
    Gradually expand tree to reveal all 3 levels: collection, group, item
    """        
    nav = NavigationHelper(driver)

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
    
    def test_add_item_from_initial(s,driver):
        """ Requirement: Add an item.
        Add from initial screen with blank fields.
        """
        nav = NavigationHelper(driver)
        form = ItemHelper(driver)

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
        """
        nav = NavigationHelper(driver)

        nav.click(["user1"])
        nav.click(["user1","web/"])
        assert nav.visible(('user1','web/', 'Facepalm'))
        nav.click(["user1","web/","Facepalm"])
        form = ItemHelper(driver)
        assert form.fields == {
            "collectionid":"user1",
            "groupid":"web",
            "notes":"Forget privacy!",
            "password":"bobknows",
            "title":"Facepalm",
            "url":"https://facepalm.com",
            "userid":"bob",
        }
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
        }
        assert form.message == "Deleted entry web/Facepalm"
        visible = nav.visiblelist()
        assert visible == [
            (u'linuxadmin',),
            (u'user1',HISTGROUP),
            (u'user1',u'Pauls Stuff/'),
            (u'user1',u'network/'),
            (u'user1',u'web/', u'google'),
            (u'user1',u'web/', u'netflix'),
        ]

        nav.click(["user1", HISTGROUP])
        title = datetime.datetime.strftime(delete_ts,'web|Facepalm|%Y%m%d%H%M%S')
        assert nav.archived(delete_ts, ('user1','web','Facepalm') ), "title: %s" % title



    def test_delete_from_archived(s,driver):
        pass

# Delete from Archived

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

