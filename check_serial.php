<?php
try {
    $c = new PDO('mysql:host=127.0.0.1;dbname=adk_admin', 'root', '');
    $r = $c->query("SHOW COLUMNS FROM members LIKE 'serial_no'");
    $rows = $r->fetchAll();
    echo count($rows) > 0 ? 'EXISTS' : 'NOT_EXISTS';
} catch(Exception $e) {
    echo 'ERROR: ' . $e->getMessage();
}
